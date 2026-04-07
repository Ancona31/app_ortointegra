import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Spinus®',
  description: 'Términos y condiciones de uso de la plataforma Spinus.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4 sm:px-8">
      <article className="mx-auto max-w-3xl prose prose-slate prose-headings:font-semibold">
        <h1>Términos de Servicio</h1>
        <p className="text-sm text-slate-500">Última actualización: 5 de abril de 2026</p>

        <h2>1. Aceptación de los términos</h2>
        <p>
          Al registrarse y utilizar Spinus® (&quot;la Plataforma&quot;), usted acepta estos
          Términos de Servicio en su totalidad. Si no está de acuerdo con alguno de los términos,
          no utilice la Plataforma.
        </p>

        <h2>2. Descripción del servicio</h2>
        <p>
          Spinus® es una plataforma de gestión clínica diseñada para profesionales de la salud.
          El servicio incluye:
        </p>
        <ul>
          <li>Gestión de expedientes clínicos electrónicos.</li>
          <li>Agenda de citas con sincronización opcional a Google Calendar.</li>
          <li>Generación de documentos médicos (recetas, notas, consentimientos).</li>
          <li>Análisis clínicos asistidos por inteligencia artificial.</li>
          <li>Dashboard con indicadores de práctica médica.</li>
          <li>Sistema de facturación y suscripciones.</li>
        </ul>

        <h2>3. Registro y cuenta</h2>
        <ul>
          <li>Usted debe proporcionar información veraz y actualizada al registrarse.</li>
          <li>Es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
          <li>Debe notificar de inmediato cualquier uso no autorizado de su cuenta.</li>
          <li>Una cuenta corresponde a un profesional de salud. Las cuentas no son transferibles.</li>
        </ul>

        <h2>4. Uso aceptable</h2>
        <p>El usuario se compromete a:</p>
        <ul>
          <li>Utilizar la Plataforma exclusivamente para fines de gestión clínica legítima.</li>
          <li>No almacenar información falsa o fraudulenta en los expedientes.</li>
          <li>Cumplir con la normatividad mexicana aplicable, incluyendo la NOM-004-SSA3-2012 (expediente clínico) y la LFPDPPP (protección de datos).</li>
          <li>No intentar acceder a datos de otros usuarios o clínicas.</li>
          <li>No realizar ingeniería inversa, descompilar o intentar extraer el código fuente.</li>
          <li>No utilizar la Plataforma para enviar spam o comunicaciones no solicitadas.</li>
        </ul>

        <h2>5. Planes y pagos</h2>
        <ul>
          <li>Spinus® ofrece un plan gratuito con funcionalidades limitadas y planes de suscripción de pago.</li>
          <li>Los pagos se procesan de forma segura a través de Stripe, Inc.</li>
          <li>Las suscripciones se renuevan automáticamente según el periodo contratado (mensual o anual).</li>
          <li>Puede cancelar su suscripción en cualquier momento desde el portal de facturación. La cancelación toma efecto al final del periodo pagado.</li>
          <li>No se realizan reembolsos por periodos parciales, salvo lo dispuesto por la Ley Federal de Protección al Consumidor.</li>
          <li>Nos reservamos el derecho de modificar los precios con aviso previo de 30 días.</li>
        </ul>

        <h2>6. Propiedad intelectual</h2>
        <p>
          El código fuente, diseño, marca y contenido de la Plataforma son propiedad de Spinus®.
          Los datos clínicos introducidos por el usuario son propiedad del profesional de salud
          responsable y de sus pacientes, conforme a la legislación aplicable.
        </p>

        <h2>7. Inteligencia artificial</h2>
        <ul>
          <li>La Plataforma utiliza modelos de inteligencia artificial como herramienta de apoyo clínico.</li>
          <li>Las sugerencias generadas por IA <strong>no sustituyen el juicio clínico</strong> del profesional de salud.</li>
          <li>El médico es el único responsable de las decisiones clínicas tomadas con base en la información proporcionada por la Plataforma.</li>
          <li>Spinus® no garantiza la exactitud, completitud o idoneidad de los análisis generados por IA.</li>
        </ul>

        <h2>8. Disponibilidad del servicio</h2>
        <p>
          Spinus® se esfuerza por mantener la Plataforma disponible de forma continua, pero no
          garantiza un tiempo de actividad del 100%. Podrán existir interrupciones por mantenimiento,
          actualizaciones o circunstancias fuera de nuestro control. No seremos responsables por
          daños derivados de la indisponibilidad temporal del servicio.
        </p>

        <h2>9. Limitación de responsabilidad</h2>
        <ul>
          <li>Spinus® es una herramienta de gestión administrativa y clínica. No proporciona diagnósticos ni tratamientos médicos.</li>
          <li>No somos responsables por decisiones clínicas tomadas con base en la información de la Plataforma.</li>
          <li>Nuestra responsabilidad máxima se limita al monto pagado por el usuario en los últimos 12 meses.</li>
          <li>No somos responsables por pérdida de datos causada por el uso indebido de la Plataforma por parte del usuario.</li>
        </ul>

        <h2>10. Suspensión y terminación</h2>
        <p>Nos reservamos el derecho de suspender o cancelar una cuenta si:</p>
        <ul>
          <li>El usuario viola estos Términos de Servicio.</li>
          <li>Se detecta actividad fraudulenta o uso indebido.</li>
          <li>El pago de la suscripción falla de forma reiterada.</li>
        </ul>
        <p>
          En caso de terminación, el usuario podrá solicitar una copia de sus datos dentro de los
          30 días posteriores a la cancelación.
        </p>

        <h2>11. Modificaciones</h2>
        <p>
          Nos reservamos el derecho de modificar estos Términos de Servicio. Los cambios serán
          notificados a través de la Plataforma con al menos 15 días de anticipación. El uso
          continuado de la Plataforma tras la notificación constituye aceptación de los nuevos
          términos.
        </p>

        <h2>12. Legislación aplicable</h2>
        <p>
          Estos Términos de Servicio se rigen por las leyes de los Estados Unidos Mexicanos.
          Cualquier controversia será sometida a los tribunales competentes de Mérida, Yucatán,
          México.
        </p>

        <h2>13. Contacto</h2>
        <p>
          Para cualquier consulta sobre estos términos, contáctenos en{' '}
          <a href="mailto:contacto@spinus.com.mx">contacto@spinus.com.mx</a>.
        </p>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 no-underline">
            &larr; Volver al inicio
          </Link>
        </div>
      </article>
    </main>
  )
}
