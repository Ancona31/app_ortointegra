import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { pregunta } = await req.json()
    if (!pregunta) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Eres un asistente clínico de apoyo para el Dr. Angel M. Ancona Pérez, Cirujano de Columna y Traumatólogo Ortopedista.
Responde preguntas clínicas de forma concisa y precisa: nombres comerciales de medicamentos, posología, dosis, interacciones, maniobras exploratorias, escalas clínicas, clasificaciones, etc.
Responde siempre en español, con lenguaje médico formal pero directo.
Si la pregunta involucra dosis, incluye: dosis, vía, frecuencia y duración habitual.
Si mencionas un medicamento, incluye el nombre genérico y al menos un nombre comercial disponible en México.
Sé breve — máximo 5-6 líneas por respuesta.`,
      messages: [{ role: 'user', content: pregunta }],
    })

    const respuesta = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ respuesta })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
