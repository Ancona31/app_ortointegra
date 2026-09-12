import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { logAudit } from '@/lib/audit'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { mensajeParaPaciente, nombreArchivoAdjunto } from '@/lib/documentos/correoPaciente'
import { descargarPdfEmitido } from '@/lib/documentos/adjuntoPdf'

/* ═══ ENVÍO DEL DOCUMENTO AL PACIENTE ═══
   Se adjunta el ARCHIVO. El cuerpo del correo solo dice qué llegó y qué hacer
   con ello; todo el contenido clínico viaja dentro del PDF.

   ⚠️⚠️ QUÉ HABÍA AQUÍ ANTES, PARA QUE NO VUELVA. Esta ruta componía un HTML que
   METÍA EL EXPEDIENTE EN EL CUERPO DEL CORREO: los medicamentos con presentación,
   principio activo y posología; los estudios de laboratorio e imagen; el plan de
   suplementación con sus justificaciones; el cuerpo entero del escrito médico; el
   procedimiento del consentimiento; el hospital y el MOTIVO del internamiento; y
   los conceptos y el total de los honorarios. Y no adjuntaba nada. Era el reverso
   exacto de lo que hace ahora.

   Un correo no viaja cifrado de extremo a extremo de forma garantizada, se queda
   en los servidores de dos proveedores y se lee sin abrirlo en la lista del
   buzón. Es la misma clase de fuga que cerró `/r/[folio]`, pero saliendo por
   correo. `generarHtmlEmail` se eliminó ENTERA; si vuelve a aparecer una función
   que lea `doc.contenido` para pintarlo en el cuerpo, la fuga volvió.

   Lo único que se lee de `contenido` es `paciente` para el saludo, y ni siquiera:
   se lee `folio` y `tipo`, que son de la columna. Ver abajo.

   ⚠️ SOLO ENVÍA EL MÉDICO QUE EMITIÓ EL DOCUMENTO. El correo va a su nombre, así
   que no puede mandarlo un tercero de la clínica: el paciente recibe el documento
   DE SU MÉDICO, y la firma del pie tiene que ser de quien lo firmó en el papel.
   Antes bastaba con estar autenticado y pasar la RLS de la clínica.

   ⚠️ EL ADJUNTO ES EL PDF GUARDADO AL EMITIR, no uno recompuesto. Ver
   `adjuntoPdf.ts`. Y si no hay archivo, NO SE MANDA NADA: un correo que anuncia
   un adjunto y llega vacío es peor que no mandarlo. */

const resend = new Resend(process.env.RESEND_API_KEY)

const REMITENTE = 'Spinus <noreply@mail.spinus.com.mx>'

/** Máximo de envíos por médico y hora. */
const LIMITE_POR_HORA = 10

interface FilaDocumento {
  readonly id: string
  readonly tipo: string
  readonly folio: string | null
  readonly pdf_url: string | null
  readonly paciente_id: string | null
  readonly consulta_id: string | null
  readonly estado: string | null
  readonly subido_por: string | null
}

interface FilaConsultorio {
  readonly nombre: string | null
  readonly direccion: string | null
  readonly telefono: string | null
}

/**
 * El consultorio que va en la firma, para que el paciente sepa DÓNDE preguntar.
 *
 * `documentos` no guarda consultorio, así que se busca por la consulta que lo
 * originó; los documentos sueltos —los que se emiten sin consulta— caen al
 * consultorio predeterminado del médico. Es contacto, no dato clínico.
 *
 * Devuelve `null` sin ruido si no hay ninguno: la firma se compone igual, solo
 * que sin dirección. Un envío no se cae por esto.
 */
async function consultorioDeLaFirma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultaId: string | null,
  medicoId: string,
): Promise<FilaConsultorio | null> {
  if (consultaId !== null) {
    const { data: consulta } = await supabase
      .from('consultas')
      .select('consultorio_id')
      .eq('id', consultaId)
      .single<{ consultorio_id: string | null }>()

    if (consulta?.consultorio_id) {
      const { data } = await supabase
        .from('consultorios')
        .select('nombre, direccion, telefono')
        .eq('id', consulta.consultorio_id)
        .single<FilaConsultorio>()
      if (data) return data
    }
  }

  const { data } = await supabase
    .from('consultorios')
    .select('nombre, direccion, telefono')
    .eq('medico_id', medicoId)
    .eq('es_default', true)
    .maybeSingle<FilaConsultorio>()

  return data ?? null
}

interface FilaPerfil {
  readonly titulo: string | null
  readonly nombres: string | null
  readonly apellido_paterno: string | null
  readonly apellido_materno: string | null
  readonly especialidad: string | null
  readonly cedula_profesional: string | null
  readonly cedula_especialidad: string | null
}

/**
 * Los mismos filtros que exige enviar, para poder preguntar antes de hacerlo.
 * Devuelve el documento y el correo de la ficha, o una respuesta de error ya
 * compuesta. Sale de `POST` para que `GET` no pueda contestar con criterios más
 * flojos: si mañana se endurece el envío, la consulta se endurece con él.
 */
async function documentoDelMedico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentoId: string,
  userId: string,
): Promise<{ doc: FilaDocumento } | { fallo: NextResponse }> {
  const { data: doc } = await supabase
    .from('documentos')
    .select('id, tipo, folio, pdf_url, paciente_id, consulta_id, estado, subido_por')
    .eq('id', documentoId)
    .single<FilaDocumento>()

  if (!doc) {
    return { fallo: NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 }) }
  }
  if (doc.estado === 'borrador') {
    return {
      fallo: NextResponse.json(
        { error: 'Este documento es un borrador. Emítelo antes de enviarlo.' },
        { status: 400 },
      ),
    }
  }
  if (doc.subido_por !== null && doc.subido_por !== userId) {
    return {
      fallo: NextResponse.json(
        { error: 'Solo el médico que emitió el documento puede enviarlo.' },
        { status: 403 },
      ),
    }
  }
  return { doc }
}

/** El correo de la ficha del paciente, o cadena vacía. Siempre en minúsculas. */
async function correoDeLaFicha(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pacienteId: string | null,
): Promise<string> {
  if (pacienteId === null) return ''
  const { data } = await supabase
    .from('pacientes')
    .select('email')
    .eq('id', pacienteId)
    .single<{ email: string | null }>()
  return data?.email?.trim().toLowerCase() ?? ''
}

/**
 * `GET ?documentoId=…` — qué dirección propondrá el envío.
 *
 * Existe para que el modal pueda ENSEÑAR el destinatario antes de mandar nada,
 * y para saber si hay que pedirlo. Sin esto, el médico pulsaba a ciegas y se
 * enteraba del destino por el acuse, cuando ya no había vuelta atrás.
 *
 * Devuelve el correo del paciente, que es dato personal, así que pasa por los
 * MISMOS filtros que enviar: solo lo ve el médico que emitió el documento, que
 * es quien ya lo tiene delante en la ficha.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const documentoId = req.nextUrl.searchParams.get('documentoId')?.trim() ?? ''
  if (documentoId === '') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const resultado = await documentoDelMedico(supabase, documentoId, user.id)
  if ('fallo' in resultado) return resultado.fallo

  const correoFicha = await correoDeLaFicha(supabase, resultado.doc.paciente_id)

  return NextResponse.json({
    correoFicha: correoFicha === '' ? null : correoFicha,
    pacienteId: resultado.doc.paciente_id,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const cuerpo: unknown = await req.json()
  const datos = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as {
    documentoId?: unknown
    pacienteEmail?: unknown
    confirmarEmailAlterno?: unknown
  }

  const documentoId = typeof datos.documentoId === 'string' ? datos.documentoId : ''
  /* Opcional desde este cambio: el modal posterior a la emisión no conoce el
     correo del paciente y no tiene por qué. Cuando no llega, manda el de la
     ficha. Ver el bloque del destinatario. */
  const emailPedido = typeof datos.pacienteEmail === 'string' ? datos.pacienteEmail.trim() : ''
  const confirmarEmailAlterno = datos.confirmarEmailAlterno === true

  if (documentoId === '') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const hace1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('ruta', 'enviar-documento')
    .gte('created_at', hace1h)

  if ((count ?? 0) >= LIMITE_POR_HORA) {
    return NextResponse.json(
      { error: `Has alcanzado el límite de ${LIMITE_POR_HORA} envíos por hora. Intenta más tarde.` },
      { status: 429 },
    )
  }

  /* Documento, borrador y autoría: los mismos filtros que usa `GET`. Un intento
     de envío por quien no lo emitió sí deja rastro; la consulta previa no. */
  const resultado = await documentoDelMedico(supabase, documentoId, user.id)
  if ('fallo' in resultado) {
    if (resultado.fallo.status === 403) {
      logAudit({
        userId: user.id,
        accion: 'enviar_documento_denegado',
        tabla: 'documentos',
        registroId: documentoId,
        ip,
        descripcion: 'Intento de envío por un usuario que no emitió el documento.',
      })
    }
    return resultado.fallo
  }
  const doc = resultado.doc

  // ── El destinatario ───────────────────────────────────────────────────────
  const emailRegistrado = await correoDeLaFicha(supabase, doc.paciente_id)

  /* Sin dirección pedida manda la de la ficha. Es la vía del modal posterior a
     la emisión, que solo conoce el id del documento. */
  const destino = emailPedido !== '' ? emailPedido : emailRegistrado
  if (destino === '') {
    return NextResponse.json(
      { error: 'Este paciente no tiene correo registrado en su ficha.' },
      { status: 400 },
    )
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(destino)) {
    return NextResponse.json({ error: 'Email del paciente inválido' }, { status: 400 })
  }

  /* Mandar a una dirección distinta de la de la ficha exige una segunda llamada
     confirmada: es la barrera contra el dedo que se equivoca de paciente. */
  if (emailRegistrado !== '' && emailRegistrado !== destino.toLowerCase() && !confirmarEmailAlterno) {
    logAudit({
      userId: user.id,
      accion: 'enviar_documento_denegado',
      tabla: 'documentos',
      registroId: documentoId,
      ip,
      descripcion: `Email solicitado (${destino.toLowerCase()}) no coincide con el registrado. Requiere confirmación.`,
    })
    return NextResponse.json({ error: 'email_mismatch', emailRegistrado }, { status: 403 })
  }

  // ── El médico que firma ───────────────────────────────────────────────────
  const { data: perfil } = await supabase
    .from('profiles')
    .select('titulo, nombres, apellido_paterno, apellido_materno, especialidad, cedula_profesional, cedula_especialidad')
    .eq('id', user.id)
    .single<FilaPerfil>()

  const medicoNombre = componerNombreMedicoCompleto({
    titulo: perfil?.titulo,
    nombres: perfil?.nombres,
    apellido_paterno: perfil?.apellido_paterno,
    apellido_materno: perfil?.apellido_materno,
  }).trim() || 'Su médico'

  // ── El archivo. Sin él no se manda nada. ──────────────────────────────────
  const adjunto = await descargarPdfEmitido(
    supabase,
    doc.pdf_url,
    nombreArchivoAdjunto(doc.tipo, doc.folio),
  )

  if (adjunto === null) {
    return NextResponse.json(
      {
        error: 'Este documento no tiene el PDF guardado, así que no hay archivo que adjuntar. '
          + 'Ábrelo desde la lista de documentos del paciente y regenéralo antes de enviarlo.',
      },
      { status: 409 },
    )
  }

  // ── El mensaje ────────────────────────────────────────────────────────────
  const mensaje = mensajeParaPaciente(doc.tipo, doc.folio, medicoNombre)
  const consultorio = await consultorioDeLaFirma(supabase, doc.consulta_id, user.id)
  const firma: Firma = {
    nombre: medicoNombre,
    especialidad: perfil?.especialidad?.trim() ?? '',
    cedulaProfesional: perfil?.cedula_profesional?.trim() ?? '',
    cedulaEspecialidad: perfil?.cedula_especialidad?.trim() ?? '',
    consultorio: consultorio?.nombre?.trim() ?? '',
    direccion: consultorio?.direccion?.trim() ?? '',
    telefono: consultorio?.telefono?.trim() ?? '',
  }

  /* Se registra el intento ANTES de mandar: un fallo del proveedor que no
     consumiera cupo dejaría el límite abierto a reintentos en bucle. */
  await supabase.from('rate_limits').insert({ user_id: user.id, ruta: 'enviar-documento' })

  const { error } = await resend.emails.send({
    from: REMITENTE,
    to: destino,
    subject: mensaje.asunto,
    text: componerTexto(mensaje.parrafos, firma),
    html: componerHtml(mensaje.parrafos, firma),
    attachments: [{ filename: adjunto.nombre, content: adjunto.contenido }],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({
    userId: user.id,
    accion: 'enviar_documento',
    tabla: 'documentos',
    registroId: documentoId,
    ip,
    /* El folio y el destino, nunca el contenido: el audit_log lo leen ojos que
       no tienen por qué ver el expediente. */
    descripcion: `${doc.folio ?? doc.tipo} enviado por correo a ${destino}`,
  })

  return NextResponse.json({ ok: true, enviadoA: destino })
}

interface Firma {
  readonly nombre: string
  readonly especialidad: string
  readonly cedulaProfesional: string
  readonly cedulaEspecialidad: string
  readonly consultorio: string
  readonly direccion: string
  readonly telefono: string
}

/** Las cédulas en un renglón, o cadena vacía si el perfil no las tiene. */
function lineaCedulas(firma: Firma): string {
  const partes: string[] = []
  if (firma.cedulaProfesional !== '') partes.push(`Céd. Prof. ${firma.cedulaProfesional}`)
  if (firma.cedulaEspecialidad !== '') partes.push(`Céd. Esp. ${firma.cedulaEspecialidad}`)
  return partes.join(' · ')
}

/**
 * El consultorio en renglones, ya filtrados los vacíos.
 *
 * Un perfil recién creado puede no tener consultorio, y entonces la firma se
 * queda en nombre y especialidad. No se inventa nada: una dirección equivocada
 * manda al paciente a tocar una puerta que no es.
 */
function lineasConsultorio(firma: Firma): string[] {
  const lineas: string[] = []
  if (firma.consultorio !== '') lineas.push(firma.consultorio)
  if (firma.direccion !== '') lineas.push(firma.direccion)
  if (firma.telefono !== '') lineas.push(`Tel. ${firma.telefono}`)
  return lineas
}

/**
 * ⚠️ LA PARTE `text/plain` NO ES UN RESPALDO DECORATIVO: ES EL MENSAJE.
 *
 * Hay buzones que tiran el HTML entero —clientes en modo texto, lectores de
 * pantalla configurados así, reglas corporativas, relojes—. Si el mensaje se
 * pierde ahí, está mal planteado. Por eso el HTML de abajo no dice NI UNA
 * palabra que no esté aquí: el formato ordena, no informa.
 */
function componerTexto(parrafos: readonly string[], firma: Firma): string {
  /* La firma va en UN bloque de renglones seguidos —no en párrafos sueltos—
     porque en texto llano es lo que se lee como una firma y no como más mensaje. */
  const firmado = [firma.nombre]
  if (firma.especialidad !== '') firmado.push(firma.especialidad)
  const cedulas = lineaCedulas(firma)
  if (cedulas !== '') firmado.push(cedulas)
  firmado.push(...lineasConsultorio(firma))

  return [
    ...parrafos,
    '--',
    firmado.join('\n'),
    'Enviado con Spinus · Sistema de Gestión Clínica',
  ].join('\n\n')
}

/** Escapa lo que va a parar dentro del HTML. Todo esto es texto, nunca marcado. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * El correo con formato.
 *
 * ── LO QUE SE DESCARTA, Y POR QUÉ ───────────────────────────────────────────
 * Los buzones recortan estilos, ignoran hojas externas y componen cada uno a su
 * manera, así que aquí solo entra lo que sobrevive en TODOS:
 *
 *  · Sin logo en imagen. Casi todos los clientes bloquean las imágenes remotas
 *    por omisión, así que la marca saldría como un recuadro roto justo arriba.
 *    Spinus va como TEXTO, al pie.
 *  · Sin hoja de estilos ni `<style>`: Gmail poda el `<head>` y varios buzones
 *    web reescriben los selectores. Todo va en `style=` por elemento.
 *  · Sin columnas. Una sola tabla de un solo carril, que es lo único que Outlook
 *    compone igual que los demás.
 *  · Sin `flex` ni `grid`: Outlook (motor Word) no los conoce y el bloque colapsa.
 *    El total de honorarios del correo viejo usaba `display:flex` dentro de un
 *    degradado — en Outlook quedaba texto blanco sobre fondo blanco.
 *  · Sin degradados ni fondos compuestos, por lo mismo.
 *  · Sin tipografías externas: pila del sistema. Una `@font-face` remota no la
 *    carga ningún cliente serio.
 *  · Sin color como portador de significado: lo que dice el mensaje se entiende
 *    en negro sobre blanco, que es como lo verá quien tenga el HTML desactivado.
 *
 * ── DE QUIÉN ES EL CORREO ───────────────────────────────────────────────────
 * El paciente recibe algo de SU MÉDICO. Por eso el nombre del médico es lo más
 * grande de la firma y Spinus firma pequeño al pie — el mismo reparto que la
 * página de verificación.
 */
function componerHtml(parrafos: readonly string[], firma: Firma): string {
  const cuerpo = parrafos
    .map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b4a5c;">${escapar(p)}</p>`)
    .join('')

  const especialidad = firma.especialidad !== ''
    ? `<p style="margin:2px 0 0;font-size:14px;color:#5a6b81;">${escapar(firma.especialidad)}</p>`
    : ''

  const cedulas = lineaCedulas(firma)
  const lineaCed = cedulas !== ''
    ? `<p style="margin:6px 0 0;font-size:12px;color:#8a99ac;">${escapar(cedulas)}</p>`
    : ''

  const consultorio = lineasConsultorio(firma)
  const bloqueConsultorio = consultorio.length > 0
    ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#5a6b81;">`
      + consultorio.map(escapar).join('<br>')
      + `</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f5f8fc;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f8fc;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e6ebf2;">

        <tr><td style="padding:24px 28px 4px;">
          ${cuerpo}
        </td></tr>

        <tr><td style="padding:8px 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid #eef1f6;padding-top:18px;">
              <p style="margin:0;font-size:16px;font-weight:bold;color:#173156;">${escapar(firma.nombre)}</p>
              ${especialidad}
              ${lineaCed}
              ${bloqueConsultorio}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 28px;background-color:#fbfcfe;border-top:1px solid #eef1f6;">
          <p style="margin:0;font-size:11px;color:#8a99ac;">
            Enviado con Spinus · Sistema de Gestión Clínica
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
