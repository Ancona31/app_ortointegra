/**
 * textoEncargo.ts — «Tratamiento de datos personales por cuenta del Usuario»:
 * el acuerdo de encargo que va como sección de los Términos y Condiciones
 * (documento 4 de `docs/spec/privacidad-2026-12/`). La pinta `TerminosContent`.
 *
 * ⚠️ TEXTO LEGAL APROBADO PARA LA BETA: copia LITERAL del documento, en
 * Markdown, con su marcador `[N]` (el número de la sección lo pone
 * `TerminosContent`; `textosLegales.test.tsx` lo exige byte a byte). No se
 * redacta, no se resume y no se «mejora» aquí.
 */
export const ENCARGO_PLANTILLA = `# Sección [N]. Tratamiento de datos personales por cuenta del Usuario

Esta sección forma parte de los Términos y Condiciones de Spinus. La acepta el Usuario al crear su cuenta y rige mientras use la plataforma y durante el tiempo en que Spinus conserve los datos a que se refiere.

## [N].1 Partes y definiciones

**Spinus:** Angel Manuel Ancona Pérez, persona física que opera la plataforma Spinus, con domicilio en Calle 12 D número 910, entre calles 12 C y 25, Tixcacal, C.P. 97312, Mérida, Yucatán, México.

**Usuario:** el profesional de la salud o la clínica titular de la cuenta.

**Datos de Pacientes:** los datos personales, incluidos los datos de salud y demás datos sensibles, de los pacientes del Usuario y de las personas que reservan una cita en línea con él, que el Usuario o esas personas registran en la plataforma.

**Ley:** la Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicada en el Diario Oficial de la Federación el 20 de marzo de 2025, su Reglamento y las disposiciones que deriven de ella.

## [N].2 Papel de cada parte

1. Respecto de los Datos de Pacientes, el Usuario es el responsable del tratamiento y Spinus es la persona encargada: los trata por cuenta del Usuario y conforme a sus instrucciones.
2. Respecto de los datos de la cuenta del Usuario y de su personal, Spinus es responsable y los trata conforme a su Aviso de Privacidad.
3. Cuando la cuenta pertenece a una clínica con varios profesionales, el responsable es el titular de la cuenta. Corresponde a este definir, con los profesionales que atienden en ella, quién responde ante los pacientes.

## [N].3 Objeto y duración del encargo

Spinus trata los Datos de Pacientes con el único objeto de prestar al Usuario los servicios de la plataforma: expediente clínico electrónico, agenda, reserva de citas en línea, generación y envío de documentos médicos, comunicaciones a pacientes y asistencia de inteligencia artificial para la redacción de notas.

El encargo dura lo que dure la relación entre las partes y el periodo posterior previsto en el apartado [N].12.

## [N].4 Instrucciones del Usuario

1. Son instrucciones del Usuario: la configuración que este y su personal hacen en la plataforma, las acciones que ejecutan en ella y las reglas estándar del servicio descritas en el apartado [N].5, que el Usuario adopta como propias al activar la función correspondiente.
2. Spinus avisará al Usuario si considera que una instrucción es contraria a la Ley, y podrá abstenerse de ejecutarla.
3. Spinus no tratará los Datos de Pacientes para finalidades propias. Si lo hiciera, responderá como responsable en los términos de la Ley.
4. Spinus podrá elaborar estadísticas agregadas sobre el uso de la plataforma que no permitan identificar a ningún paciente.

## [N].5 Reglas estándar del servicio

Al activar la reserva de citas en línea, el Usuario instruye a Spinus para que:

1. Pida a quien reserva su nombre, su teléfono y su correo electrónico; le muestre el aviso de privacidad simplificado del consultorio y registre su aceptación con la versión, la fecha y la hora.
2. Verifique el correo con un código de un solo uso cuando la reserva se hace con el enlace general del consultorio.
3. Envíe por correo el comprobante de la cita y, si el Usuario lo activa, recordatorios con un enlace para confirmar, cancelar o reagendar, y un aviso a los administradores de la clínica por cada reserva.
4. Lleve, mediante códigos que sustituyen al teléfono y al correo, el historial de reservas, cancelaciones e inasistencias de cada persona con cada profesional, y con él limite de forma automática las reservas en línea. Los valores vigentes son: una cita activa por persona, pausa de las reservas tras tres cancelaciones o inasistencias en sesenta días, y un máximo de dos reagendados por cita. El Usuario puede bloquear y desbloquear manualmente un teléfono o un correo, y con ello atender a quien pida que una persona revise su caso.
5. Limite el número de intentos por conexión y por navegador para proteger el servicio, mediante una cookie técnica y códigos que sustituyen a la dirección IP.

Spinus informará al Usuario antes de cambiar estos valores.

## [N].6 Obligaciones del Usuario

El Usuario se obliga a:

1. Poner su aviso de privacidad a disposición de sus pacientes antes de recabar sus datos. Spinus genera un aviso modelo con los datos del consultorio; el Usuario es responsable de que esos datos sean correctos y de que el aviso corresponda a su práctica.
2. Recabar el consentimiento de sus pacientes en la forma que la Ley exige, incluido el consentimiento expreso y por escrito para los datos de salud cuando proceda, y conservar la constancia. La casilla con que el personal declara en la plataforma haber informado al paciente no sustituye a ese consentimiento.
3. Atender las solicitudes de acceso, rectificación, cancelación y oposición, las revocaciones del consentimiento y las solicitudes de limitación de sus pacientes, dentro de los plazos de la Ley.
4. Mantener actualizados en la plataforma el nombre, el domicilio, el teléfono y el correo de contacto que aparecen en su aviso.
5. Dar acceso solo a su personal autorizado, con una cuenta por persona, y retirar el acceso a quien deje de colaborar con él.
6. Cumplir la normativa sanitaria sobre el expediente clínico, incluida su conservación.
7. No escribir datos de salud de sus pacientes en los títulos de los eventos de la agenda, que se copian tal cual al calendario de Google cuando este está conectado.
8. Informar a sus pacientes de las vulneraciones de seguridad cuando la Ley lo exija.

## [N].7 Obligaciones de Spinus

Spinus se obliga a:

1. Tratar los Datos de Pacientes únicamente conforme a las instrucciones del Usuario y a esta sección.
2. Guardar confidencialidad sobre ellos, obligación que subsiste después de terminada la relación.
3. Limitar el acceso de su propio personal a lo indispensable para dar soporte, mantener la plataforma y atender incidentes de seguridad.
4. Aplicar las medidas de seguridad del apartado [N].8.
5. No comunicar los Datos de Pacientes a terceros, salvo a los subencargados del apartado [N].9, por instrucción del Usuario o por mandato fundado y motivado de autoridad competente. En este último caso avisará al Usuario, salvo que la ley se lo prohíba.
6. Remitir al Usuario, sin demora, las solicitudes que reciba directamente de un paciente, e informar a este de que debe dirigirse a su consultorio.
7. Ayudar al Usuario a atender esas solicitudes con las herramientas de la plataforma: consulta y exportación del expediente, rectificación de datos de identificación, notas de aclaración y anonimización del paciente.
8. Entregar al Usuario, cuando lo pida, la información necesaria para acreditar el cumplimiento de esta sección.

## [N].8 Medidas de seguridad

Spinus mantiene, al menos, las siguientes medidas:

1. Cifrado de las comunicaciones y cifrado de la base de datos por el proveedor.
2. Separación de la información de cada clínica y acceso según la función de cada usuario.
3. Bitácora de operaciones que no admite modificación ni borrado.
4. Notas clínicas que no pueden modificarse una vez guardadas; las correcciones se hacen por nota de aclaración.
5. Límite de intentos de acceso.
6. Retiro de nombres, teléfonos, correos, domicilios, fechas de nacimiento e identificadores antes de enviar texto a servicios de inteligencia artificial.
7. Filtros que retiran datos personales de los reportes de errores.

## [N].9 Subencargados

1. El Usuario autoriza a Spinus a contratar a los siguientes proveedores, que tratan los Datos de Pacientes por cuenta del Usuario:

| Proveedor | Servicio | Ubicación del tratamiento |
|---|---|---|
| Supabase | Base de datos y autenticación | Oregon, Estados Unidos de América |
| Vercel | Alojamiento y ejecución de la aplicación | Portland, Estados Unidos de América |
| Resend | Envío de correo electrónico | Puede tratar los datos fuera de México |
| Sentry | Monitoreo de errores, con filtros de datos personales | Puede tratar los datos fuera de México |
| Google | Asistencia de inteligencia artificial sobre texto sin identificadores | Puede tratar los datos fuera de México |

2. Spinus exige a estos proveedores obligaciones de confidencialidad y seguridad equivalentes a las de esta sección y responde ante el Usuario por ellos.
3. Spinus avisará al Usuario antes de añadir o sustituir un proveedor. Si el Usuario se opone por causa razonable, podrá terminar la relación sin penalización.
4. El Usuario acepta que los Datos de Pacientes se alojen y traten fuera de México en los términos de la tabla anterior.

## [N].10 Integraciones que conecta el Usuario

Si el Usuario conecta su cuenta de Google Calendar, instruye a Spinus para copiar sus citas a un calendario de esa cuenta. Se envían a Google el nombre del paciente o de quien reservó, la fecha y la hora, el nombre de la clínica y el título de los eventos que el Usuario escriba, y Google envía la invitación al profesional. No se envían teléfono, correo, tipo de cita ni información clínica.

La cuenta de Google es del Usuario: Google trata esos datos conforme a las condiciones que el Usuario aceptó con Google, y corresponde al Usuario informarlo en su aviso de privacidad. El Usuario puede desconectar la integración en cualquier momento; lo ya copiado permanece en su cuenta de Google.

Cuando el personal del Usuario abre una conversación de WhatsApp desde la plataforma, lo hace desde su propio dispositivo y cuenta; Spinus no envía mensajes ni comunica datos a ese servicio.

## [N].11 Vulneraciones de seguridad

Spinus avisará al Usuario de cualquier vulneración de seguridad que afecte a los Datos de Pacientes dentro de las 72 horas siguientes a que la confirme, al correo de la cuenta. El aviso incluirá la naturaleza del incidente, los datos comprometidos, las medidas correctivas tomadas y las recomendaciones para los afectados, y se completará conforme avance la investigación.

Corresponde al Usuario informar a sus pacientes. Spinus le dará el apoyo razonable para hacerlo.

## [N].12 Terminación, devolución y conservación

1. Al terminar la suscripción, el Usuario conserva el acceso de consulta a los expedientes ya registrados, para leerlos y exportarlos.
2. Spinus conservará los Datos de Pacientes mientras el Usuario no instruya otra cosa, para que este pueda cumplir su obligación de conservar el expediente clínico.
3. El Usuario puede instruir por escrito, desde el correo de su cuenta, la supresión o la anonimización de los Datos de Pacientes. Spinus la ejecutará dentro de los 30 días naturales siguientes, salvo respecto de lo que deba conservar por mandato de autoridad, y advertirá antes al Usuario si la instrucción afecta expedientes que aún no cumplen el plazo mínimo de conservación sanitaria.
4. La bitácora de operaciones no contiene información clínica y se conserva de forma permanente.
5. Si Spinus dejara de operar la plataforma, avisará al Usuario con al menos 60 días naturales de anticipación para que exporte su información.

## [N].13 Responsabilidad

Cada parte responde de los daños que cause por incumplir las obligaciones que esta sección y la Ley le imponen. Spinus responde como responsable del tratamiento si usa los Datos de Pacientes para una finalidad distinta de las instruidas o los comunica en contra de lo previsto en esta sección.

## [N].14 Cambios a esta sección

Spinus comunicará al Usuario los cambios a esta sección al correo de su cuenta con al menos 15 días naturales de anticipación, salvo que deban aplicarse antes para cumplir una obligación legal o por seguridad.`
