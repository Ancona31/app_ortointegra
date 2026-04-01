import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TIPO_LABEL: Record<string, string> = {
  receta: 'Receta médica',
  solicitud_lab: 'Solicitud de laboratorio',
  solicitud_imagen: 'Solicitud de imagen',
  plan_suplementacion: 'Plan de suplementación',
  informe_clinico: 'Informe clínico',
  escrito_medico: 'Escrito médico',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { documentoId, pacienteEmail } = await req.json()
  if (!documentoId || !pacienteEmail) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(pacienteEmail)) {
    return NextResponse.json({ error: 'Email del paciente inválido' }, { status: 400 })
  }

  const { data: doc } = await supabase
    .from('documentos')
    .select('tipo, contenido, created_at')
    .eq('id', documentoId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, titulo, especialidad')
    .eq('id', user.id)
    .single()

  const medicoNombre = [profile?.titulo, profile?.nombre].filter(Boolean).join(' ') || doc.contenido?.medico || 'Tu médico'
  const tipoLabel = TIPO_LABEL[doc.tipo] || doc.tipo
  const html = generarHtmlEmail(doc, medicoNombre, tipoLabel)

  const { error } = await resend.emails.send({
    from: 'OrthoIntegra <noreply@ortointegra.com>',
    to: pacienteEmail,
    subject: `${tipoLabel} — ${medicoNombre}`,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

function generarHtmlEmail(doc: any, medicoNombre: string, tipoLabel: string): string {
  const { tipo, contenido, created_at } = doc
  const fecha = new Date(created_at).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  let cuerpo = ''

  if (tipo === 'receta' && contenido?.medicamentos?.length) {
    const meds = contenido.medicamentos
      .filter((m: any) => m.nombre_comercial)
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
    cuerpo = `<ul style="list-style:none;padding:0;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;padding:0 16px;">${items}</ul>`
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
  } else if (tipo === 'plan_suplementacion' && contenido?.suplementos?.length) {
    const items = contenido.suplementos
      .map((s: any, i: number) => `<li style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
        <strong style="color:#1e293b;">${i + 1}. ${s.nombre}</strong>${s.dosis ? ` — ${s.dosis}` : ''}
        ${s.justificacion ? `<br><span style="color:#64748b;font-size:12px;">${s.justificacion}</span>` : ''}
      </li>`)
      .join('')
    cuerpo = `<ul style="list-style:none;padding:0;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${items}</ul>`
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1a3a5c,#1e5fa8);padding:28px;">
      <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">OrthoIntegra</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${tipoLabel}</h1>
    </div>
    <div style="padding:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
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
        Documento generado el ${fecha}. Este mensaje fue enviado desde el sistema de gestión clínica OrthoIntegra.
      </p>
    </div>
  </div>
</body>
</html>`
}
