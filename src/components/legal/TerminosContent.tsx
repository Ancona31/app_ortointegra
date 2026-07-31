import Link from 'next/link'
import LegalLayout from './LegalLayout'
import {
  FileText,
  ArrowLeft,
  Calendar,
  MapPin,
  ListChecks,
  CheckCircle2,
  UserCheck,
  Cpu,
  Briefcase,
  History,
  CreditCard,
  Activity,
  ShieldAlert,
  Copyright,
  Ban,
  RefreshCw,
  Scale,
  Mail,
  Mail as MailIcon,
  Receipt,
  TrendingUp,
  Undo2,
  AlertTriangle,
  Network,
  ExternalLink,
} from 'lucide-react'

/* v2.1 (2026-07-31): entra la sección 19, "Continuidad y cese definitivo del
   servicio", y con ella se renumeran las tres que iban detrás (19→20, 20→21,
   21→22). Los `id` de ancla NO cambiaron: los enlaces existentes siguen vivos.
   La versión sube porque la sección nueva añade una obligación de Spinus
   —aviso previo y 90 días de exportación— que antes no estaba escrita, no
   porque se reordenara la numeración. */
const TERMINOS_VERSION = 'v2.1'
const TERMINOS_FECHA = '31 de julio de 2026'

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
  { id: 'aceptacion', num: '1', title: 'Aceptación de los términos' },
  { id: 'descripcion', num: '2', title: 'Descripción del servicio' },
  { id: 'cuenta', num: '3', title: 'Registro, cuenta y roles' },
  { id: 'responsabilidad-medico', num: '4', title: 'Responsabilidad del usuario médico' },
  { id: 'ia', num: '5', title: 'Inteligencia artificial como herramienta de apoyo' },
  { id: 'propiedad-datos', num: '6', title: 'Propiedad de los datos clínicos' },
  { id: 'retencion', num: '7', title: 'Retención y soft delete' },
  { id: 'pagos', num: '8', title: 'Suscripciones, pagos y reembolsos' },
  { id: 'terminos-pago', num: '9', title: 'Términos de pago' },
  { id: 'cambios-plan', num: '10', title: 'Cambios de plan' },
  { id: 'reembolsos', num: '11', title: 'Reembolsos y cancelaciones' },
  { id: 'suspension-pago', num: '12', title: 'Suspensión por falta de pago' },
  { id: 'disponibilidad', num: '13', title: 'Disponibilidad del servicio y respaldos' },
  { id: 'componentes-terceros', num: '14', title: 'Componentes de terceros' },
  { id: 'enlaces-externos', num: '15', title: 'Enlaces externos' },
  { id: 'limitacion', num: '16', title: 'Limitación de responsabilidad' },
  { id: 'propiedad-intelectual', num: '17', title: 'Propiedad intelectual' },
  { id: 'terminacion', num: '18', title: 'Suspensión y terminación' },
  { id: 'continuidad', num: '19', title: 'Continuidad y cese definitivo del servicio' },
  { id: 'modificaciones', num: '20', title: 'Modificaciones a los términos' },
  { id: 'jurisdiccion', num: '21', title: 'Legislación aplicable y jurisdicción' },
  { id: 'contacto', num: '22', title: 'Contacto' },
]

export default function TerminosContent() {
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
              <FileText size={20} className="text-white/80" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Términos y Condiciones</h1>
          </div>
          <p className="text-white/60 text-sm">
            Plataforma de expedientes clínicos electrónicos con asistencia de IA
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-4 pb-16">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 px-4 sm:px-8 py-4 border-b border-slate-100 text-[11px] text-[#86868b]">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} /> Última actualización: {TERMINOS_FECHA}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText size={12} /> Versión: {TERMINOS_VERSION}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={12} /> Mérida, Yucatán, México
            </span>
          </div>

          {/* Índice */}
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
            {/* 1 */}
            <Section
              id="aceptacion"
              num="1"
              title="Aceptación de los términos"
              icon={<CheckCircle2 size={14} />}
            >
              <p>
                Al registrarse y utilizar Spinus® (en adelante, &ldquo;la Plataforma&rdquo;), usted
                acepta de forma íntegra los presentes Términos y Condiciones, así como el{' '}
                <Link
                  href="/privacidad"
                  className="text-[#1e5fa8] font-medium hover:underline"
                >
                  Aviso de Privacidad
                </Link>{' '}
                que forma parte indisoluble de los mismos. Si usted no está de acuerdo con alguno de
                los términos, debe abstenerse de utilizar la Plataforma.
              </p>
            </Section>

            {/* 2 */}
            <Section
              id="descripcion"
              num="2"
              title="Descripción del servicio"
              icon={<Briefcase size={14} />}
            >
              <p>
                Spinus® es una plataforma de expedientes clínicos electrónicos con asistencia de
                inteligencia artificial, dirigida a profesionales de la salud y clínicas. Incluye:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>Gestión de expedientes clínicos electrónicos por paciente.</li>
                <li>
                  Generación de recetas médicas verificables, solicitudes de laboratorio e imagen,
                  notas de evolución, consentimientos informados, escritos médicos, planes de
                  suplementación y recibos de honorarios.
                </li>
                <li>
                  Asistencia de inteligencia artificial sobre datos clínicos previamente
                  anonimizados, para redacción de notas y extracción estructurada de resultados de
                  laboratorio.
                </li>
                <li>Agenda médica con sincronización opcional a Google Calendar.</li>
                <li>Estadísticas internas e indicadores de práctica del médico.</li>
                <li>Sistema de suscripciones procesado a través de Stripe, Inc.</li>
              </ul>
            </Section>

            {/* 3 */}
            <Section
              id="cuenta"
              num="3"
              title="Registro, cuenta y roles"
              icon={<UserCheck size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  El usuario debe proporcionar información veraz, completa y actualizada al
                  registrarse y al dar de alta a sus pacientes.
                </li>
                <li>
                  Es responsabilidad exclusiva del usuario mantener la confidencialidad de sus
                  credenciales de acceso. Cualquier actividad realizada con sus credenciales será
                  imputable al usuario titular.
                </li>
                <li>
                  El usuario debe notificar de inmediato cualquier uso no autorizado de su cuenta al
                  correo de contacto.
                </li>
                <li>
                  Las cuentas no son transferibles. Una clínica puede tener múltiples usuarios
                  según los roles habilitados en su plan: super_admin, admin, médico y secretaria.
                </li>
                <li>
                  Los planes de suscripción definen el número máximo de médicos y secretarias por
                  clínica.
                </li>
              </ul>
            </Section>

            {/* 4 */}
            <Section
              id="responsabilidad-medico"
              num="4"
              title="Responsabilidad del usuario médico"
              icon={<ShieldAlert size={14} />}
            >
              <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/60">
                <p className="text-[13px] font-semibold text-[#92400e] mb-2">
                  Obligaciones esenciales del profesional de salud
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[#78350f]">
                  <li>
                    El médico es el único responsable de la veracidad, exactitud y completitud de
                    los datos clínicos que registra en la plataforma.
                  </li>
                  <li>
                    El médico debe revisar, validar y, en su caso, corregir todo contenido generado
                    por inteligencia artificial antes de guardarlo en el expediente. La IA es una
                    herramienta de asistencia y no sustituye en ningún caso el criterio clínico
                    profesional.
                  </li>
                  <li>
                    Las notas clínicas guardadas son inmutables. Cualquier corrección,
                    rectificación o aclaración debe realizarse exclusivamente mediante adendas
                    (addendums), las cuales quedan vinculadas a la nota original sin alterar su
                    contenido.
                  </li>
                  <li>
                    El médico debe utilizar la plataforma exclusivamente para fines de gestión
                    clínica legítima y conforme a la lex artis médica.
                  </li>
                  <li>
                    El médico es responsable de obtener el consentimiento informado del paciente
                    para los procedimientos y tratamientos que registre en la plataforma.
                  </li>
                </ul>
              </div>
              <p className="mt-3">El usuario se compromete adicionalmente a:</p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>
                  Cumplir con la normatividad mexicana aplicable, en particular la
                  NOM-004-SSA3-2012, la NOM-024-SSA3-2012, la Ley General de Salud y la LFPDPPP.
                </li>
                <li>No intentar acceder a datos de otros usuarios o clínicas.</li>
                <li>
                  No realizar ingeniería inversa, descompilar ni intentar extraer el código fuente
                  de la Plataforma.
                </li>
                <li>No utilizar la Plataforma para enviar comunicaciones no solicitadas (spam).</li>
                <li>No registrar información falsa, fraudulenta o con fines distintos al servicio médico.</li>
              </ul>
            </Section>

            {/* 5 */}
            <Section
              id="ia"
              num="5"
              title="Inteligencia artificial como herramienta de apoyo"
              icon={<Cpu size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  La Plataforma utiliza modelos de inteligencia artificial de Google (Gemini) y
                  Anthropic (Claude) como herramientas de apoyo a la documentación clínica.
                </li>
                <li>
                  Los datos enviados a estos servicios son previamente anonimizados conforme se
                  describe en la sección VI del Aviso de Privacidad.
                </li>
                <li>
                  Las sugerencias generadas por la IA{' '}
                  <strong className="text-[#1d1d1f]">
                    no constituyen un diagnóstico ni un tratamiento médico
                  </strong>{' '}
                  y no sustituyen en ningún caso el juicio clínico del profesional de salud.
                </li>
                <li>
                  Spinus no garantiza la exactitud, completitud, vigencia ni idoneidad del
                  contenido generado por IA. El médico es el único responsable de validar y, en su
                  caso, corregir dicho contenido antes de incorporarlo al expediente clínico.
                </li>
                <li>
                  El uso de la asistencia de IA implica la aceptación expresa de estas condiciones
                  por parte del médico.
                </li>
              </ul>
            </Section>

            {/* 6 */}
            <Section
              id="propiedad-datos"
              num="6"
              title="Propiedad de los datos clínicos"
              icon={<FileText size={14} />}
            >
              <p>
                Conforme a la NOM-004-SSA3-2012, los expedientes clínicos son propiedad de la
                institución o del prestador de servicios médicos que los genera, sin perjuicio del
                derecho del paciente a obtener un resumen clínico cuando lo solicite.
              </p>
              <p>
                Spinus actúa como encargado del tratamiento por cuenta del responsable (la clínica
                o el profesional de salud), proporcionando la infraestructura técnica para el
                almacenamiento, gestión y resguardo de los expedientes. La propiedad y la
                titularidad de los datos clínicos no se transfieren a Spinus en ningún momento.
              </p>
              <p>
                El paciente conserva en todo momento sus derechos como titular de los datos
                personales, los cuales podrá ejercer conforme al procedimiento descrito en el Aviso
                de Privacidad.
              </p>
            </Section>

            {/* 7 */}
            <Section
              id="retencion"
              num="7"
              title="Retención y soft delete"
              icon={<History size={14} />}
            >
              <p>
                Conforme a la NOM-004-SSA3-2012, los expedientes clínicos se conservan por un
                periodo mínimo de cinco (5) años contados a partir de la última atención médica.
              </p>
              <p>
                Los expedientes nunca se eliminan físicamente de la base de datos. En caso de
                cancelación solicitada por el paciente, los datos identificables se anonimizan
                mediante un proceso de borrado lógico (soft delete), preservando los datos clínicos
                disociados conforme a la normatividad sanitaria.
              </p>
              <p>
                La eliminación física de un paciente con historial clínico está técnicamente
                impedida en la base de datos mediante restricciones de integridad referencial (ON
                DELETE RESTRICT).
              </p>
            </Section>

            {/* 8 */}
            <Section
              id="pagos"
              num="8"
              title="Suscripciones, pagos y reembolsos"
              icon={<CreditCard size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  Spinus ofrece planes de suscripción cuyas características y precios se publican
                  en la sección de planes de la Plataforma.
                </li>
                <li>
                  Todos los pagos se procesan de forma segura a través de{' '}
                  <strong className="text-[#1d1d1f]">Stripe, Inc.</strong> Spinus no almacena
                  números de tarjeta ni datos bancarios sensibles del usuario.
                </li>
                <li>
                  Las suscripciones se renuevan automáticamente al final del periodo contratado
                  (mensual o anual), salvo cancelación previa por parte del usuario.
                </li>
                <li>
                  El usuario puede cancelar su suscripción en cualquier momento desde el portal de
                  facturación. La cancelación toma efecto al final del periodo ya pagado y
                  conserva el acceso a la plataforma hasta esa fecha.
                </li>
                <li>
                  No se realizan reembolsos por periodos parciales ya facturados, salvo lo
                  dispuesto por la Ley Federal de Protección al Consumidor.
                </li>
                <li>
                  Spinus se reserva el derecho de modificar los precios de los planes con un aviso
                  previo de al menos 30 días publicado en la Plataforma.
                </li>
              </ul>
            </Section>

            {/* 9 — NEW */}
            <Section
              id="terminos-pago"
              num="9"
              title="Términos de pago"
              icon={<Receipt size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Método de pago aceptado:</strong> tarjeta de
                  crédito o débito procesada exclusivamente a través de{' '}
                  <strong className="text-[#1d1d1f]">Stripe, Inc.</strong> Spinus no procesa pagos
                  por transferencia, efectivo ni otros métodos al margen de Stripe, y no almacena
                  números de tarjeta en ningún servidor propio.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Ciclos de facturación:</strong> mensual o
                  anual, según el plan contratado por el usuario. La fecha de cobro recurrente
                  corresponde al día del alta de la suscripción.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Cobro automático:</strong> al contratar un
                  plan de pago, el usuario autoriza a Stripe a realizar cargos automáticos
                  recurrentes al método de pago registrado, por el monto correspondiente al ciclo
                  vigente, hasta que el usuario cancele la suscripción.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Mantenimiento del método de pago:</strong> es
                  responsabilidad exclusiva del usuario mantener vigente y con fondos suficientes
                  el método de pago registrado. El usuario puede actualizarlo en cualquier momento
                  desde el portal de facturación.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Comprobantes:</strong> tras cada cobro
                  exitoso, Stripe genera un comprobante electrónico que se envía al correo
                  electrónico registrado por el usuario.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Impuestos:</strong> los precios publicados
                  podrán o no incluir impuestos según se indique. Cualquier impuesto aplicable
                  conforme a la legislación mexicana es responsabilidad del usuario.
                </li>
              </ul>
            </Section>

            {/* 10 — NEW */}
            <Section
              id="cambios-plan"
              num="10"
              title="Cambios de plan"
              icon={<TrendingUp size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Cambio a un plan superior (upgrade):</strong>{' '}
                  el cambio toma efecto de inmediato. Stripe calcula la diferencia mediante el
                  mecanismo estándar de prorrateo del periodo en curso y la cobra al método de
                  pago registrado.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Cambio a un plan inferior (downgrade):</strong>{' '}
                  el cambio toma efecto al inicio del siguiente ciclo de facturación. Hasta esa
                  fecha, el usuario conserva las funcionalidades del plan superior por el cual ya
                  pagó.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Sin reembolso por downgrade:</strong> Spinus
                  no realiza reembolsos por la diferencia entre planes al cambiar a un plan
                  inferior. El monto pagado del ciclo en curso no es prorrateable a la baja.
                </li>
                <li>
                  Si la nueva configuración del plan implica una reducción del número de usuarios
                  permitidos (médicos o secretarias), el administrador de la clínica deberá ajustar
                  los usuarios activos antes de que el cambio surta efecto.
                </li>
              </ul>
            </Section>

            {/* 11 — NEW */}
            <Section
              id="reembolsos"
              num="11"
              title="Reembolsos y cancelaciones"
              icon={<Undo2 size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Cancelación voluntaria:</strong> el usuario
                  puede cancelar su suscripción en cualquier momento desde el portal de
                  facturación. La cancelación toma efecto al término del periodo ya pagado, sin
                  cargos adicionales.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Acceso hasta el final del periodo:</strong>{' '}
                  tras cancelar, el usuario conserva acceso completo a la plataforma y a sus
                  expedientes hasta la fecha de finalización del periodo facturado.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Sin reembolso por periodos parciales:</strong>{' '}
                  Spinus no realiza reembolsos por días no utilizados dentro de un periodo ya
                  facturado, salvo lo dispuesto por la Ley Federal de Protección al Consumidor.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Los datos clínicos no se eliminan al
                  cancelar:</strong> los expedientes clínicos están sujetos a la obligación de
                  retención mínima de cinco (5) años establecida en la NOM-004-SSA3-2012.
                  Spinus conserva los expedientes durante este periodo aun cuando el usuario haya
                  cancelado su suscripción, en cumplimiento de la normatividad sanitaria.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Exportación previa a la cancelación:</strong>{' '}
                  antes de cancelar, el usuario médico tiene derecho a exportar su información
                  clínica desde la plataforma. Es responsabilidad del usuario realizar dicha
                  exportación dentro del periodo en que conserve acceso activo.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Reactivación posterior:</strong> si el usuario
                  decide reactivar su suscripción dentro del periodo de retención, podrá recuperar
                  el acceso a sus expedientes previa contratación de un plan vigente.
                </li>
              </ul>
            </Section>

            {/* 12 — NEW */}
            <Section
              id="suspension-pago"
              num="12"
              title="Suspensión por falta de pago"
              icon={<AlertTriangle size={14} />}
            >
              <p>
                En caso de que el cobro automático del ciclo de facturación falle (por tarjeta
                vencida, fondos insuficientes, rechazo del banco emisor u otras causas), Stripe
                realizará reintentos automáticos durante un periodo razonable.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  Si tras los reintentos el pago no se concreta, Spinus se reserva el derecho de
                  <strong className="text-[#1d1d1f]"> suspender el acceso del usuario</strong> a
                  las funcionalidades de la plataforma hasta que se regularice la situación de
                  pago.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Conservación obligatoria del expediente:</strong>{' '}
                  aun durante una suspensión por falta de pago, los expedientes clínicos
                  permanecen almacenados de forma íntegra y segura en cumplimiento del periodo
                  mínimo de retención establecido por la NOM-004-SSA3-2012. Spinus no elimina
                  expedientes por falta de pago.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Restauración del acceso:</strong> al
                  regularizar el pago pendiente, el acceso del usuario a sus expedientes y a la
                  plataforma se restaura automáticamente, sin pérdida de información.
                </li>
                <li>
                  Spinus notificará al usuario por correo electrónico antes de aplicar la
                  suspensión, otorgando un plazo razonable para regularizar el método de pago.
                </li>
              </ul>
            </Section>

            {/* 13 */}
            <Section
              id="disponibilidad"
              num="13"
              title="Disponibilidad del servicio y respaldos"
              icon={<Activity size={14} />}
            >
              <p>
                Spinus se esfuerza por mantener la Plataforma disponible de forma continua, pero
                <strong className="text-[#1d1d1f]"> no garantiza un tiempo de actividad del 100%</strong>.
                Pueden existir interrupciones por mantenimiento programado, actualizaciones,
                incidencias técnicas o circunstancias fuera del control razonable de Spinus.
              </p>
              <p>
                Se realizan respaldos automáticos periódicos a nivel del proveedor de base de
                datos. Spinus no es responsable por daños derivados de la indisponibilidad temporal
                del servicio.
              </p>
            </Section>

            {/* 14 — NEW */}
            <Section
              id="componentes-terceros"
              num="14"
              title="Componentes de terceros"
              icon={<Network size={14} />}
            >
              <p>
                La plataforma Spinus se apoya en servicios de terceros para su operación. Cada uno
                de estos servicios cuenta con sus propios términos y políticas de privacidad, los
                cuales son ajenos al control de Spinus:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Stripe, Inc.</strong> — procesamiento de pagos
                  y suscripciones.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Supabase, Inc.</strong> — base de datos,
                  autenticación y almacenamiento.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Vercel, Inc.</strong> — hospedaje y entrega de
                  la aplicación.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Google LLC</strong> — Gemini API para
                  asistencia de IA y Google Calendar para sincronización opcional de agenda.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Anthropic, PBC</strong> — modelo Claude para
                  extracción estructurada de resultados de laboratorio.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Resend</strong> — entrega transaccional de
                  correos electrónicos.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Sentry</strong> — monitoreo de errores y
                  telemetría de rendimiento.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Meta Platforms, Inc.</strong> (próxima
                  integración) — recordatorios por WhatsApp.
                </li>
              </ul>
              <p>
                Spinus aplica filtros de anonimización y minimización de datos antes de cualquier
                transferencia a estos servicios, conforme se detalla en el{' '}
                <Link href="/privacidad" className="text-[#1e5fa8] font-medium hover:underline">
                  Aviso de Privacidad
                </Link>
                . No obstante,{' '}
                <strong className="text-[#1d1d1f]">
                  Spinus no controla los términos, las políticas, la disponibilidad ni los cambios
                </strong>{' '}
                que estos proveedores puedan introducir en sus servicios. Cualquier interrupción,
                modificación o falla atribuible a un servicio de terceros no es imputable a Spinus.
              </p>
            </Section>

            {/* 15 — NEW */}
            <Section
              id="enlaces-externos"
              num="15"
              title="Enlaces externos"
              icon={<ExternalLink size={14} />}
            >
              <p>
                La Plataforma puede contener enlaces a sitios web, recursos o servicios de
                terceros. Estos enlaces se proporcionan únicamente para facilitar la consulta y no
                implican respaldo, validación ni recomendación por parte de Spinus.
              </p>
              <p>
                <strong className="text-[#1d1d1f]">
                  Spinus no se hace responsable del contenido, la disponibilidad, las prácticas de
                  privacidad ni las prácticas de seguridad de los sitios externos
                </strong>{' '}
                a los que se pueda acceder desde la Plataforma. El uso de dichos sitios queda
                sujeto a los términos y políticas de los respectivos terceros, y se realiza bajo la
                exclusiva responsabilidad del usuario.
              </p>
            </Section>

            {/* 16 */}
            <Section
              id="limitacion"
              num="16"
              title="Limitación de responsabilidad"
              icon={<ShieldAlert size={14} />}
            >
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  Spinus es una herramienta de gestión clínica y administrativa.{' '}
                  <strong className="text-[#1d1d1f]">
                    No proporciona diagnósticos ni tratamientos médicos
                  </strong>
                  .
                </li>
                <li>
                  Spinus no se hace responsable por diagnósticos, prescripciones o tratamientos
                  derivados del uso de la Plataforma. La responsabilidad clínica recae
                  exclusivamente en el profesional de salud que utiliza el servicio.
                </li>
                <li>
                  Spinus no es responsable por pérdida de datos causada por uso indebido de la
                  Plataforma por parte del usuario o por acciones de terceros ajenos al servicio.
                </li>
                <li>
                  La responsabilidad máxima de Spinus, en cualquier caso, se limita al monto pagado
                  por el usuario por concepto de suscripción durante los doce (12) meses anteriores
                  al hecho que origine la reclamación.
                </li>
              </ul>
            </Section>

            {/* 17 */}
            <Section
              id="propiedad-intelectual"
              num="17"
              title="Propiedad intelectual"
              icon={<Copyright size={14} />}
            >
              <p>
                El código fuente, diseño, marca, identidad visual, logotipos y contenido editorial
                de la Plataforma son propiedad de Spinus®. La marca <strong>Spinus®</strong> y sus
                elementos distintivos se encuentran protegidos por la legislación aplicable en
                materia de propiedad industrial e intelectual.
              </p>
              <p>
                Los datos clínicos introducidos por el usuario son propiedad del prestador de
                servicios médicos conforme a la NOM-004-SSA3-2012, sin perjuicio de los derechos
                del paciente como titular de sus datos personales.
              </p>
            </Section>

            {/* 18 */}
            <Section
              id="terminacion"
              num="18"
              title="Suspensión y terminación"
              icon={<Ban size={14} />}
            >
              <p>Spinus se reserva el derecho de suspender o cancelar una cuenta cuando:</p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>El usuario incumple los presentes Términos y Condiciones.</li>
                <li>Se detecta actividad fraudulenta o uso indebido del servicio.</li>
                <li>El pago de la suscripción falla de forma reiterada.</li>
                <li>Se compromete la seguridad de la Plataforma o de los datos de terceros.</li>
              </ul>
              <p>
                En caso de terminación, el usuario podrá solicitar una copia de sus datos dentro de
                los treinta (30) días naturales posteriores a la cancelación. Tras dicho plazo, los
                datos quedarán sujetos exclusivamente a las obligaciones de retención sanitaria
                descritas en la sección 7.
              </p>
            </Section>

            {/* 19 — ⚠️ SECCIÓN NUEVA (2026-07-31). NO LA BORRES SIN BORRAR
                TAMBIÉN LA PREGUNTA 9 DE LA FAQ PÚBLICA.
                La landing responde "¿Qué pasa si Spinus deja de operar?" con
                un aviso previo y 90 días de ventana de exportación, y remata:
                "Está escrito en los términos de servicio, no es una promesa de
                buena voluntad" (`components/landing/faq-contenido.ts`). Antes
                de esta tanda NO estaba escrito en ningún sitio: lo único que
                había era la sección 18, que cubre la terminación de UNA cuenta
                (30 días), no el cese de la Plataforma.
                Las dos cosas van juntas: si esta sección desaparece, aquella
                respuesta pasa a ser falsa. */}
            <Section
              id="continuidad"
              num="19"
              title="Continuidad y cese definitivo del servicio"
              icon={<History size={14} />}
            >
              <p>
                En caso de que Spinus decida discontinuar la Plataforma de forma definitiva, lo
                notificará con anticipación a los titulares de las cuentas activas, por correo
                electrónico y mediante aviso dentro de la propia Plataforma.
              </p>
              <p>
                A partir de dicha notificación, la Plataforma permanecerá disponible en modo de
                consulta y exportación durante un plazo de{' '}
                <strong className="text-[#1d1d1f]">noventa (90) días naturales</strong>, durante el
                cual el usuario médico podrá descargar el historial clínico de sus pacientes en los
                formatos que la Plataforma ofrezca. Concluido ese plazo, el acceso cesará y la
                información dejará de estar disponible a través de la Plataforma.
              </p>
              <p>
                Este plazo es adicional e independiente del previsto en la sección 18 para la
                terminación de una cuenta individual.
              </p>
              <p>
                La obligación de conservar el expediente clínico conforme a la NOM-004-SSA3-2012
                corresponde al profesional de la salud, no a Spinus. La ventana de exportación
                descrita en esta sección es el medio previsto para que el usuario médico pueda
                cumplir con dicha obligación.
              </p>
            </Section>

            {/* 20 */}
            <Section
              id="modificaciones"
              num="20"
              title="Modificaciones a los términos"
              icon={<RefreshCw size={14} />}
            >
              <p>
                Spinus se reserva el derecho de modificar los presentes Términos y Condiciones en
                cualquier momento. Los cambios serán notificados a través de la Plataforma con al
                menos quince (15) días naturales de anticipación. El uso continuado del servicio
                tras la notificación constituye aceptación de los nuevos términos.
              </p>
            </Section>

            {/* 21 */}
            <Section
              id="jurisdiccion"
              num="21"
              title="Legislación aplicable y jurisdicción"
              icon={<Scale size={14} />}
            >
              <p>
                Los presentes Términos y Condiciones se rigen por las leyes de los Estados Unidos
                Mexicanos. Cualquier controversia derivada de su interpretación, cumplimiento o
                ejecución será sometida a la competencia de los tribunales con sede en Mérida,
                Yucatán, México, renunciando las partes a cualquier otro fuero que pudiera
                corresponderles por razón de domicilio presente o futuro.
              </p>
            </Section>

            {/* 22 */}
            <Section id="contacto" num="22" title="Contacto" icon={<Mail size={14} />}>
              <p>
                Para cualquier consulta sobre los presentes Términos y Condiciones, puede
                contactarnos en:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <MailIcon size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="mailto:contacto@spinus.com.mx"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  contacto@spinus.com.mx
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
                Versión {TERMINOS_VERSION} · {TERMINOS_FECHA}
              </p>
            </div>
          </div>
        </div>
      </div>
    </LegalLayout>
  )
}
