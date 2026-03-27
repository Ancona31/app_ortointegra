import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Vercel Pro permite hasta 300s — necesario para PDFs extensos
export const maxDuration = 300

const PROMPT = `Eres un médico especialista en medicina funcional y de precisión con amplio conocimiento en interpretación de laboratorios clínicos.

Analiza este reporte de laboratorio y extrae TODOS los valores encontrados. Para cada parámetro proporciona:
1. El valor del reporte
2. El rango de referencia del laboratorio (si aparece)
3. Tu criterio sobre el rango ÓPTIMO según medicina funcional/evidencia actual (más estricto que el rango de referencia)
4. Un estado clínico basado en el rango óptimo

Devuelve ÚNICAMENTE un JSON válido con esta estructura:

{
  "fecha_toma": "YYYY-MM-DD o null",
  "laboratorio_nombre": "nombre del laboratorio o null",
  "paciente_nombre": "nombre del paciente o null",
  "resultados": [
    {
      "nombre": "Nombre completo del parámetro",
      "valor": 0.0,
      "unidad": "unidad",
      "rango_ref": "rango de referencia del laboratorio, ej: 70-100 o <5.7",
      "rango_optimo": "rango óptimo según evidencia médica actual, ej: 80-90 o <5.0",
      "estado": "optimo | suboptimo | bajo | alto | normal",
      "nota_clinica": "breve nota clínica solo si el valor es relevante o está fuera de rango, sino null"
    }
  ],
  "valores": {
    "vitamina_d": number o null,
    "insulina_basal": number o null,
    "trigliceridos": number o null,
    "pcr_us": number o null,
    "albumina": number o null,
    "tgp_alt": number o null,
    "tsh": number o null,
    "hba1c": number o null,
    "creatinina": number o null,
    "cistatina_c": number o null
  }
}

Criterios para el campo "estado":
- "optimo": dentro del rango óptimo
- "suboptimo": dentro del rango de referencia pero fuera del óptimo
- "bajo": por debajo del rango de referencia
- "alto": por encima del rango de referencia
- "normal": para parámetros cualitativos (ej. negativo/positivo) que son normales

Reglas:
- Incluye TODOS los parámetros del reporte sin excepción
- "valor" siempre debe ser número. "<0.3" → 0.3, ">100" → 100, "negativo" → 0, "positivo" → 1
- Convierte Vitamina D de nmol/L a ng/mL (÷ 2.496) si es necesario
- "rango_optimo" debe reflejar criterios de medicina funcional/longevidad, no solo el rango clásico de referencia
- "nota_clinica" solo para valores anormales o clínicamente relevantes, null para los normales
- NO incluyas texto fuera del JSON`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { jobId } = body
    if (!jobId) return NextResponse.json({ error: 'jobId requerido' }, { status: 400 })

    // Obtener el job — RLS garantiza que solo el dueño puede acceder
    const { data: job } = await supabase
      .from('pdf_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (!job) return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 })

    // Si ya fue procesado, no hacer nada (idempotencia)
    if (job.status === 'completed' || job.status === 'error')
      return NextResponse.json({ ok: true })

    // Marcar como procesando
    await supabase.from('pdf_jobs').update({ status: 'processing' }).eq('id', jobId)

    // Descargar PDF del storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('labs-pdfs')
      .download(job.file_path)

    if (downloadError || !fileData) {
      await supabase.from('pdf_jobs').update({
        status: 'error',
        error_message: 'No se pudo descargar el archivo del servidor',
      }).eq('id', jobId)
      return NextResponse.json({ error: 'Error al descargar archivo' }, { status: 500 })
    }

    const bytes = await fileData.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    // Limpiar el archivo del storage (ya no se necesita)
    await supabase.storage.from('labs-pdfs').remove([job.file_path])

    if (response.stop_reason === 'max_tokens') {
      await supabase.from('pdf_jobs').update({
        status: 'error',
        error_message: 'El PDF es demasiado extenso para procesarlo completo. Intenta con un PDF de menos páginas.',
      }).eq('id', jobId)
      return NextResponse.json({ error: 'PDF demasiado extenso' }, { status: 422 })
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      await supabase.from('pdf_jobs').update({
        status: 'error',
        error_message: 'No se pudo extraer datos estructurados del PDF',
      }).eq('id', jobId)
      return NextResponse.json({ error: 'No se pudo extraer datos' }, { status: 422 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    const valoresLimpios: Record<string, number> = {}
    if (parsed.valores) {
      for (const [k, v] of Object.entries(parsed.valores)) {
        if (v !== null && v !== undefined) valoresLimpios[k] = v as number
      }
    }

    const result = {
      valores: valoresLimpios,
      resultados: parsed.resultados ?? [],
      laboratorio_nombre: parsed.laboratorio_nombre ?? null,
      paciente_nombre: parsed.paciente_nombre ?? null,
      fecha_toma: parsed.fecha_toma ?? null,
    }

    await supabase.from('pdf_jobs').update({
      status: 'completed',
      result,
    }).eq('id', jobId)

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
