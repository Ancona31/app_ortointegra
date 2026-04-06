import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — OrtoIntegra',
  description: 'Aviso de privacidad y protección de datos personales de OrtoIntegra.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4 sm:px-8">
      <article className="mx-auto max-w-3xl prose prose-slate prose-headings:font-semibold">
        <h1>Aviso de Privacidad</h1>
        <p className="text-sm text-slate-500">Última actualización: 5 de abril de 2026</p>

        <h2>1. Responsable del tratamiento</h2>
        <p>
          <strong>OrtoIntegra</strong>, con domicilio en Mérida, Yucatán, México, es responsable del
          tratamiento de los datos personales que usted nos proporcione, de conformidad con la Ley
          Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su
          Reglamento.
        </p>

        <h2>2. Datos personales que recabamos</h2>
        <p>Para la prestación de nuestros servicios, podemos recabar los siguientes datos:</p>
        <ul>
          <li><strong>Identificación:</strong> nombre completo, correo electrónico, teléfono, cédula profesional.</li>
          <li><strong>Datos clínicos:</strong> expedientes médicos, notas de consulta, estudios de laboratorio e imagen, prescripciones y diagnósticos.</li>
          <li><strong>Datos de uso:</strong> información de sesión, dirección IP y registros de auditoría para seguridad del sistema.</li>
          <li><strong>Datos de facturación:</strong> información de pago procesada de forma segura a través de Stripe, Inc. No almacenamos números de tarjeta.</li>
        </ul>

        <h2>3. Finalidades del tratamiento</h2>
        <p>Sus datos personales serán utilizados para:</p>
        <ul>
          <li>Crear y administrar su cuenta de usuario.</li>
          <li>Gestionar expedientes clínicos electrónicos y citas médicas.</li>
          <li>Generar documentos médicos (recetas, notas, consentimientos informados).</li>
          <li>Sincronizar citas con Google Calendar cuando usted lo autorice explícitamente.</li>
          <li>Procesar pagos y facturación de suscripciones.</li>
          <li>Enviar comunicaciones relacionadas con el servicio (recordatorios de citas, notificaciones del sistema).</li>
          <li>Mantener la seguridad e integridad del sistema mediante registros de auditoría.</li>
        </ul>

        <h2>4. Integración con Google Calendar</h2>
        <p>
          OrtoIntegra solicita acceso al permiso <code>calendar.events</code> de Google Calendar
          exclusivamente para:
        </p>
        <ul>
          <li>Crear eventos de citas médicas en el calendario del profesional de salud.</li>
          <li>Leer eventos existentes para evitar conflictos de horario.</li>
          <li>Actualizar o eliminar eventos cuando una cita se modifica o cancela.</li>
        </ul>
        <p>
          Este acceso se otorga voluntariamente por el usuario y puede revocarse en cualquier momento
          desde la configuración de la cuenta o desde{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            los permisos de su cuenta de Google
          </a>.
          Los tokens de acceso se almacenan cifrados con AES-256-GCM.
        </p>

        <h2>5. Protección de datos</h2>
        <p>Implementamos las siguientes medidas de seguridad:</p>
        <ul>
          <li>Cifrado en tránsito (TLS/HTTPS) y en reposo.</li>
          <li>Cifrado AES-256-GCM para tokens de autenticación de terceros.</li>
          <li>Políticas de seguridad a nivel de fila (Row Level Security) en base de datos.</li>
          <li>Limitación de tasa de solicitudes (rate limiting) por IP.</li>
          <li>Registro de auditoría de acciones críticas.</li>
          <li>Autenticación multifactor (2FA) para cuentas administrativas.</li>
        </ul>

        <h2>6. Transferencia de datos</h2>
        <p>Sus datos pueden ser compartidos con los siguientes terceros, exclusivamente para los fines descritos:</p>
        <ul>
          <li><strong>Supabase, Inc.</strong> — almacenamiento de base de datos y autenticación.</li>
          <li><strong>Vercel, Inc.</strong> — hospedaje de la aplicación.</li>
          <li><strong>Stripe, Inc.</strong> — procesamiento de pagos.</li>
          <li><strong>Google LLC</strong> — sincronización de calendario (solo si usted lo autoriza).</li>
          <li><strong>Anthropic, PBC / Google LLC</strong> — procesamiento de inteligencia artificial para análisis clínicos (los datos se envían de forma anonimizada cuando es posible).</li>
          <li><strong>Sentry</strong> — monitoreo de errores (no incluye datos clínicos).</li>
        </ul>

        <h2>7. Derechos ARCO</h2>
        <p>
          Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos
          personales (derechos ARCO). Para ejercer estos derechos, envíe un correo electrónico a{' '}
          <a href="mailto:privacidad@ortointegra.com">privacidad@ortointegra.com</a> con el asunto
          &quot;Derechos ARCO&quot;, indicando su nombre completo y la acción solicitada.
          Responderemos en un plazo máximo de 20 días hábiles.
        </p>

        <h2>8. Conservación de datos</h2>
        <p>
          Los datos clínicos se conservan de acuerdo con la NOM-004-SSA3-2012, que establece un
          mínimo de 5 años para expedientes médicos. Los datos de cuenta se conservan mientras la
          relación comercial esté vigente. Al cancelar su cuenta, los datos se eliminan de forma
          lógica (soft delete) y se purgan completamente tras el periodo legal aplicable.
        </p>

        <h2>9. Modificaciones al aviso</h2>
        <p>
          Nos reservamos el derecho de modificar este aviso de privacidad. Cualquier cambio será
          notificado a través de la plataforma y se publicará en esta misma página con la fecha de
          actualización correspondiente.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta relacionada con este aviso de privacidad, puede contactarnos en{' '}
          <a href="mailto:privacidad@ortointegra.com">privacidad@ortointegra.com</a>.
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
