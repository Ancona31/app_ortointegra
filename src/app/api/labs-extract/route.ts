import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const prompt = `Eres un asistente médico especializado. Analiza este reporte de laboratorio y extrae los siguientes valores si están presentes.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (omite los campos que no aparezcan en el reporte):

{
  "vitamina_d": number,
  "insulina_basal": number,
  "trigliceridos": number,
  "pcr_us": number,
  "albumina": number,
  "tgp_alt": number,
  "tsh": number,
  "hba1c": number,
  "creatinina": number,
  "cistatina_c": number,
  "fecha_toma": "YYYY-MM-DD",
  "laboratorio_nombre": "nombre del laboratorio si aparece",
  "paciente_nombre": "nombre del paciente si aparece"
}

Convierte las unidades si es necesario:
- Vitamina D: convertir nmol/L a ng/mL dividiendo entre 2.496
- TSH debe estar en mIU/L
- Todos los valores deben ser números (float)

Si un valor aparece como "<0.3" usa 0.3. Si aparece como ">100" usa 100.
NO incluyas texto adicional, solo el JSON.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo extraer datos del PDF' }, { status: 422 })
    }

    const valores = JSON.parse(jsonMatch[0])
    return NextResponse.json({ valores })

  } catch (err: any) {
    console.error('Error extracción PDF:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
