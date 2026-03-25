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

    const prompt = `Eres un médico especialista en medicina funcional y de precisión con amplio conocimiento en interpretación de laboratorios clínicos.

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

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'No se pudo extraer datos del PDF' }, { status: 422 })

    const parsed = JSON.parse(jsonMatch[0])

    const valoresLimpios: Record<string, number> = {}
    if (parsed.valores) {
      for (const [k, v] of Object.entries(parsed.valores)) {
        if (v !== null && v !== undefined) valoresLimpios[k] = v as number
      }
    }

    return NextResponse.json({
      valores: valoresLimpios,
      resultados: parsed.resultados || [],
      laboratorio_nombre: parsed.laboratorio_nombre,
      paciente_nombre: parsed.paciente_nombre,
      fecha_toma: parsed.fecha_toma,
    })

  } catch (err: any) {
    console.error('Error extracción PDF:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
