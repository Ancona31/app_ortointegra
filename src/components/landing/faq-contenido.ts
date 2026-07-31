/**
 * Las 9 preguntas de la FAQ pública (§7·12b). FUENTE ÚNICA.
 *
 * ⚠️ ESTE ARCHIVO EXISTE POR LA FRONTERA RSC, NO POR GUSTO DE ABSTRAER.
 * El mismo contenido lo necesitan dos consumidores a los lados de esa
 * frontera:
 *   · `SeccionFAQ.tsx`, que es `'use client'` (el acordeón anima), y
 *   · `(landing)/layout.tsx`, que es servidor y emite el JSON-LD.
 * Importar una constante DESDE un módulo `'use client'` en un componente de
 * servidor no devuelve el valor: devuelve una referencia de cliente. Por eso
 * el dato vive en un módulo neutro —sin `'use client'`— del que cuelgan los
 * dos. Si algún día el JSON-LD se mueve al propio componente, este archivo se
 * disuelve dentro de él.
 *
 * ⚠️ EL COPY ES DEL PM Y VA LITERAL. Cada respuesta está acotada a lo que se
 * verificó en código durante la auditoría previa; ensanchar una cláusula es
 * publicar un claim falso. Lo que sostiene cada una:
 *
 *  1. `(app)/layout.tsx` no consulta la suscripción para dar acceso, así que
 *     la sesión sobrevive a la cancelación; las 7 policies de gate son
 *     `FOR INSERT` y los SELECT/UPDATE no están gateados; el webhook de
 *     `customer.subscription.deleted` solo escribe el estado, no purga nada
 *     (`stripe/webhook/route.ts:215-260`). "Historial clínico", NUNCA
 *     "expediente completo": el PDF no lleva recetas, documentos, labs ni
 *     DICOM (`ExpedienteCompletoPdf.tsx:25-29`).
 *  2. `pacientes_select_activos` y `consultas_select` (etapa 5.E/5.F). El
 *     admin de clínica ve TODO lo de su clínica: por eso la respuesta lo dice
 *     en vez de callarlo. El asistente ve pacientes y agenda pero NO consultas
 *     ni documentos. La bitácora existe y cubre lecturas (`useAuditAccess` en
 *     5 páginas). El panel de super-admin consulta conteos e identificadores
 *     (`super-admin/dashboard/clinicas/route.ts:149`); el único `nombre` que
 *     lee es para contar anonimizados y no se renderiza
 *     (`dashboard/legal/route.ts:100,146`).
 *  3. "En proceso de certificación", NUNCA "certificado": no hay folio DGIS.
 *     Ver RG-01 en §11 del maestro.
 *  4. `consultas/route.ts:103-113` bloquea con 400 si falta exploración,
 *     diagnóstico o plan; `consultas/[id]/route.ts:14-17` prohíbe el DELETE;
 *     `pacientes/[id]/route.ts:93` es soft delete con retención de 5 años.
 *     "Te ayuda", NUNCA "cumple por ti" — el obligado es el médico.
 *  5. `gemini-3.5-flash` (`nota-medica/route.ts:169,215`), entrada anonimizada
 *     (`:280,291,309-315`), tier de PAGO confirmado por Angel el 2026-07-31 —
 *     de ahí "modo empresarial". El modo manual existe
 *     (`consultas/route.ts:87-88`).
 *  6. `soporte@spinus.com.mx` es el buzón real del footer. "Nuestro objetivo",
 *     NUNCA un SLA por plan: las cifras `<24h`/`<8h` se retiraron de
 *     `plans.ts` en esta misma tanda para no prometer dos cosas distintas.
 *  7. `plans.ts:26-36` (5 pacientes, sin tarjeta, no caduca) y el portal de
 *     Stripe (`stripe/portal/route.ts:37-41`) para cancelar sin hablar con
 *     nadie.
 *  8. `plans.ts:68-69` (básica = 3 médicos + 1 asistente) y los topes que
 *     aplica `api/admin/crear-usuario/route.ts:64-69`. SIN precio.
 *  9. ⚠️ ESTA RESPUESTA DEPENDE DE UNA CLÁUSULA QUE ANTES NO EXISTÍA. Se
 *     escribió en `TerminosContent.tsx` (sección "Continuidad del servicio")
 *     en esta misma tanda. Si alguien la borra de los términos, esta
 *     respuesta pasa a ser mentira: van juntas.
 */
export interface PreguntaFAQ {
  pregunta: string
  respuesta: string
}

export const PREGUNTAS_FAQ: readonly PreguntaFAQ[] = [
  {
    pregunta: '¿Qué pasa con mis expedientes si dejo de usar Spinus?',
    respuesta:
      'Conservas el acceso. Tu cuenta sigue abierta, puedes consultar y editar lo que ya tienes, y descargar el historial clínico de cada paciente en PDF. Lo único que se bloquea es crear pacientes, consultas y documentos nuevos. No hay borrado automático ni fecha límite.',
  },
  {
    pregunta: '¿Quién puede ver la información de mis pacientes?',
    respuesta:
      'Cada médico ve solo a sus pacientes, y está separado a nivel de base de datos, no por permisos de interfaz. En cuentas de clínica, el administrador ve los expedientes de todo su equipo. Tu asistente ve la lista de pacientes y la agenda, nunca las notas ni los documentos. Cada acceso queda registrado en bitácora. Del lado nuestro, el panel de administración no muestra contenido clínico: solo conteos e identificadores.',
  },
  {
    pregunta: '¿Spinus está certificado?',
    respuesta:
      'Spinus está diseñado siguiendo los estándares y las pautas de la NOM-024-SSA3-2012, la norma que rige a los sistemas de expediente clínico electrónico en México, y se encuentra en proceso de certificación.',
  },
  {
    pregunta: '¿Spinus cumple con la NOM-004?',
    respuesta:
      'El cumplimiento es del médico, no del software — ninguna plataforma puede cumplirla por ti. Lo que hace Spinus es ayudarte: no te deja cerrar una nota sin diagnóstico ni plan de tratamiento, las notas no se borran (las correcciones van como addendum) y los expedientes se conservan cinco años.',
  },
  {
    pregunta: '¿Cómo se maneja la inteligencia artificial en las notas?',
    respuesta:
      'Tú describes los hallazgos y la IA los estructura; el criterio clínico y la firma son tuyos. Los datos van anonimizados: nunca se envía el nombre del paciente ni su identificador. El servicio está contratado en modo empresarial, así que no se usan para entrenar modelos. Y si prefieres, escribes tus notas a mano.',
  },
  {
    pregunta: '¿Cuánto tardan en responder si tengo un problema?',
    respuesta:
      'Escríbenos a soporte@spinus.com.mx. Los tiempos varían según la carga, pero nuestro objetivo es responder dentro de las 24 horas hábiles. Los planes de clínica cuentan con atención prioritaria.',
  },
  {
    pregunta: '¿Puedo probarlo sin compromiso?',
    respuesta:
      'Sí. El plan gratuito no pide tarjeta y no caduca: puedes registrar hasta cinco pacientes para ver cómo funciona. Si pasas a un plan de pago, lo cancelas tú mismo desde tu cuenta, sin llamadas ni trámites.',
  },
  {
    pregunta: '¿Funciona si mi clínica tiene varios médicos?',
    respuesta:
      'Sí. Los planes de clínica permiten dar de alta médicos y asistentes en la misma cuenta, desde tres médicos y un asistente. Cada médico ve solo a sus pacientes; el administrador de la clínica ve los expedientes de todo el equipo.',
  },
  {
    pregunta: '¿Qué pasa si Spinus deja de operar?',
    respuesta:
      'Te avisaríamos con anticipación y la plataforma seguiría disponible 90 días para que descargues todo lo que necesites. Pasado ese plazo, la información dejaría de estar disponible. Está escrito en los términos de servicio, no es una promesa de buena voluntad.',
  },
] as const
