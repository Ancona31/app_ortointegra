import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { logAudit } from '@/lib/audit'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/core'
import { editorExtensions } from '@/lib/documentos/editorExtensions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

const resend = new Resend(process.env.RESEND_API_KEY)

const TIPO_LABEL: Record<string, string> = {
  receta: 'Receta médica',
  solicitud_lab: 'Solicitud de laboratorio',
  solicitud_imagen: 'Solicitud de imagen',
  plan_suplementacion: 'Plan de suplementación',
  informe_clinico: 'Informe clínico',
  escrito_medico: 'Escrito médico',
  solicitud_internamiento: 'Solicitud de internamiento',
  consentimiento_informado: 'Consentimiento informado',
  nota_honorarios: 'Recibo de honorarios',
}

// SEGURIDAD — LFPDPPP: validar que el email destino sea el del paciente
// registrado en la DB. Si no coincide, se permite enviar a un email
// alternativo SOLO si el médico lo confirma explícitamente (flag override).
// Cada envío se registra en audit_log para trazabilidad.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { documentoId, pacienteEmail, confirmarEmailAlterno = false } = await req.json()
  if (!documentoId || !pacienteEmail) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(pacienteEmail)) {
    return NextResponse.json({ error: 'Email del paciente inválido' }, { status: 400 })
  }

  // ── Rate limiting: máximo 10 emails por hora ──
  const hace1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('ruta', 'enviar-documento')
    .gte('created_at', hace1h)

  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'Has alcanzado el límite de 10 emails por hora. Intenta más tarde.' },
      { status: 429 }
    )
  }

  // Registrar esta llamada en rate_limits
  await supabase.from('rate_limits').insert({ user_id: user.id, ruta: 'enviar-documento' })

  // ── Obtener documento (RLS filtra por clínica) ──
  const { data: doc } = await supabase
    .from('documentos')
    .select('id, tipo, contenido, created_at, paciente_id')
    .eq('id', documentoId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // ── Validar email contra el registrado del paciente ──
  if (doc.paciente_id) {
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('email')
      .eq('id', doc.paciente_id)
      .single()

    const emailRegistrado = paciente?.email?.trim().toLowerCase()
    const emailSolicitado = pacienteEmail.trim().toLowerCase()

    if (emailRegistrado && emailRegistrado !== emailSolicitado && !confirmarEmailAlterno) {
      // Email no coincide y el médico no confirmó — registrar intento y rechazar
      logAudit({
        userId: user.id,
        accion: 'enviar_documento_denegado',
        tabla: 'documentos',
        registroId: documentoId,
        ip,
        descripcion: `Email solicitado (${emailSolicitado}) no coincide con el registrado. Requiere confirmación.`,
      })
      return NextResponse.json(
        { error: 'email_mismatch', emailRegistrado: emailRegistrado },
        { status: 403 }
      )
    }
  }

  // ── Obtener perfil del médico ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('titulo, nombres, apellido_paterno, apellido_materno')
    .eq('id', user.id)
    .single()

  const medicoNombre = componerNombreMedicoCompleto({
    titulo: profile?.titulo,
    nombres: profile?.nombres,
    apellido_paterno: profile?.apellido_paterno,
    apellido_materno: profile?.apellido_materno,
  }) || doc.contenido?.medico || 'Tu médico'
  const tipoLabel = TIPO_LABEL[doc.tipo] || doc.tipo
  const html = generarHtmlEmail(doc, medicoNombre, tipoLabel)

  const { error } = await resend.emails.send({
    from: 'Spinus <noreply@mail.spinus.com.mx>',
    to: pacienteEmail,
    subject: `${tipoLabel} — ${medicoNombre}`,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Registrar envío exitoso en audit_log ──
  logAudit({
    userId: user.id,
    accion: 'enviar_documento',
    tabla: 'documentos',
    registroId: documentoId,
    ip,
    descripcion: `${tipoLabel} enviado a ${pacienteEmail}`,
  })

  return NextResponse.json({ ok: true })
}

function fmtCurrency(amount: number, currency = 'MXN'): string {
  return amount.toLocaleString(currency === 'USD' ? 'en-US' : 'es-MX', { style: 'currency', currency })
}

function generarHtmlEmail(doc: { tipo: string; contenido: Record<string, any>; created_at: string }, medicoNombre: string, tipoLabel: string): string {
  const { tipo, contenido, created_at } = doc
  const fecha = new Date(created_at).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  let cuerpo = ''

  if (tipo === 'receta' && contenido?.medicamentos?.length) {
    const meds = contenido.medicamentos
      .filter((m: { nombre_comercial?: string; presentacion?: string; principio_activo?: string; indicacion?: string }) => m.nombre_comercial)
      .map((m: any, i: number) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
            <strong style="color:#1e293b;">${i + 1}. ${m.nombre_comercial.toUpperCase()}${m.presentacion ? ` ${m.presentacion}` : ''}</strong>
            ${m.principio_activo ? `<br><span style="color:#64748b;font-size:12px;">${m.principio_activo}</span>` : ''}
            ${m.indicacion ? `<br><span style="color:#475569;font-size:13px;margin-top:4px;display:block;">${m.indicacion}</span>` : ''}
          </td>
        </tr>`)
      .join('')
    cuerpo = `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-top:16px;">${meds}</table>`
    if (contenido.recomendaciones) {
      cuerpo += `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px;font-weight:600;color:#334155;">Recomendaciones</p>
        <p style="margin:0;color:#475569;white-space:pre-line;font-size:14px;line-height:1.6;">${contenido.recomendaciones}</p>
      </div>`
    }
  } else if ((tipo === 'solicitud_lab' || tipo === 'lab') && contenido?.estudios?.length) {
    const items = contenido.estudios
      .map((e: string) => `<li style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#334155;">${e}</li>`)
      .join('')
    cuerpo = `<ul style="list-style:none;padding:0 16px;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${items}</ul>`
    if (contenido.notas) {
      cuerpo += `<p style="color:#475569;font-size:14px;">${contenido.notas}</p>`
    }
  } else if ((tipo === 'solicitud_imagen' || tipo === 'imagen') && contenido?.estudios?.length) {
    const items = contenido.estudios
      .map((e: any) => `<li style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
        <strong style="color:#1e293b;">${e.tipo} de ${e.region}</strong>${e.proyecciones ? ` <span style="color:#64748b;">(${e.proyecciones})</span>` : ''}
        ${e.indicacion ? `<br><span style="color:#64748b;font-size:12px;">${e.indicacion}</span>` : ''}
      </li>`)
      .join('')
    cuerpo = `<ul style="list-style:none;padding:0;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${items}</ul>`
  } else if (tipo === 'plan_suplementacion' && contenido?.seleccionados?.length) {
    const items = contenido.seleccionados
      .map((s: any, i: number) => `<li style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
        <strong style="color:#1e293b;">${i + 1}. ${s.nombre}</strong>${s.dosis ? ` — ${s.dosis}` : ''}
        ${s.justificacion ? `<br><span style="color:#64748b;font-size:12px;">${s.justificacion}</span>` : ''}
      </li>`)
      .join('')
    cuerpo = `<ul style="list-style:none;padding:0;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${items}</ul>`
    if (contenido.notas) {
      cuerpo += `<div style="margin-top:16px;padding:14px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;">
        <p style="margin:0 0 6px;font-weight:600;color:#92400e;font-size:13px;">Notas</p>
        <p style="margin:0;color:#78350f;font-size:14px;">${contenido.notas}</p>
      </div>`
    }
  } else if (tipo === 'escrito_medico') {
    if (contenido?.asunto) {
      cuerpo += `<div style="margin-bottom:16px;padding:12px 16px;background:#f0fdfa;border-radius:8px;border-left:4px solid #0d9488;">
        <p style="margin:0 0 2px;font-size:11px;color:#0f766e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Asunto</p>
        <p style="margin:0;font-weight:600;color:#134e4a;font-size:15px;">${contenido.asunto}</p>
      </div>`
    }
    const docPayload = contenido?.doc as { schema?: string; content?: JSONContent } | undefined
    const cuerpoHtml = docPayload?.schema === 'tiptap-doc-v1' && docPayload.content
      ? generateHTML(docPayload.content, editorExtensions)
      : (typeof contenido?.cuerpo === 'string' ? contenido.cuerpo : '')
    if (cuerpoHtml) {
      cuerpo += `<div style="padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#334155;">
        ${cuerpoHtml}
      </div>`
    }
  } else if (tipo === 'consentimiento_informado') {
    const filas = [
      contenido?.procedimiento ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Procedimiento</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.procedimiento}</td></tr>` : '',
      contenido?.familiar ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Familiar / Representante</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.familiar}</td></tr>` : '',
      contenido?.anestesiologo ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Anestesiólogo</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.anestesiologo}</td></tr>` : '',
    ].filter(Boolean).join('')
    if (filas) {
      cuerpo = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">${filas}</table>`
    }
    cuerpo += `<div style="margin-top:16px;padding:14px 16px;background:#eef2ff;border-radius:8px;border:1px solid #c7d2fe;">
      <p style="margin:0;color:#3730a3;font-size:13px;line-height:1.5;">Este documento es un consentimiento informado emitido por tu médico. Si tienes dudas, comunícate directamente con el consultorio.</p>
    </div>`
  } else if (tipo === 'solicitud_internamiento') {
    const filas = [
      contenido?.hospital ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Hospital</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.hospital}</td></tr>` : '',
      contenido?.motivo ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Motivo de internamiento</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.motivo}</td></tr>` : '',
      contenido?.tipo_internamiento ? `<tr><td style="color:#64748b;font-size:12px;padding:8px 0 2px;">Tipo</td></tr><tr><td style="font-weight:600;color:#1e293b;font-size:14px;padding-bottom:10px;">${contenido.tipo_internamiento}</td></tr>` : '',
    ].filter(Boolean).join('')
    if (filas) {
      cuerpo = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">${filas}</table>`
    }
  } else if (tipo === 'nota_honorarios') {
    if (contenido?.folio) {
      cuerpo += `<p style="font-size:12px;color:#94a3b8;margin:0 0 16px;">Folio: <span style="font-family:monospace;">${contenido.folio}</span></p>`
    }
    if (contenido?.lineas?.length) {
      const filas = contenido.lineas
        .map((l: any) => `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;">${l.concepto}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;text-align:right;font-family:monospace;">${fmtCurrency(Number(l.precio), contenido.divisa)}</td>
        </tr>`)
        .join('')
      cuerpo += `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:4px;">
        <thead><tr>
          <th style="padding:10px 14px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Concepto</th>
          <th style="padding:10px 14px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Precio</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>`
    }
    if (contenido?.monto != null) {
      cuerpo += `<div style="background:linear-gradient(135deg,#1a3a5c,#1e5fa8);border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;margin-top:8px;">
        <span style="color:#93c5fd;font-weight:600;font-size:14px;">Total</span>
        <span style="color:#ffffff;font-weight:700;font-size:18px;">${fmtCurrency(Number(contenido.monto), contenido.divisa)} <span style="font-size:11px;opacity:0.7;">${contenido.divisa || 'MXN'}</span></span>
      </div>`
    }
    if (contenido?.forma_pago) {
      cuerpo += `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Forma de pago: <strong style="color:#334155;">${contenido.forma_pago}</strong></p>`
    }
  }

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
        <tr><td style="background-color:#1a3a5c;padding:28px;">
          <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${tipoLabel}</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="color:#64748b;font-size:13px;padding-bottom:2px;">Emitido por</td>
            </tr>
            <tr>
              <td style="font-weight:600;color:#1e293b;font-size:15px;">${medicoNombre}</td>
            </tr>
            ${contenido?.paciente ? `<tr><td style="color:#64748b;font-size:13px;padding-top:12px;padding-bottom:2px;">Paciente</td></tr>
            <tr><td style="font-weight:600;color:#1e293b;font-size:15px;">${contenido.paciente}</td></tr>` : ''}
          </table>
          ${cuerpo}
          <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
            Documento generado el ${fecha}. Este mensaje fue enviado desde el sistema de gestión clínica Spinus.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
