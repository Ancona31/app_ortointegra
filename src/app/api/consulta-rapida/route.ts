import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizePromptInput } from '@/lib/sanitize'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const limitError = await checkRateLimit(user.id, 'consulta-rapida')
    if (limitError) return limitError

    const body = await req.json()
    const pregunta = sanitizePromptInput(body.pregunta, 500)
    if (!pregunta) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    // Construir historial de la conversación para contexto (máx. 20 turnos)
    type Mensaje = { rol: 'usuario' | 'claude'; texto: string }
    const historialRaw: Mensaje[] = Array.isArray(body.historial) ? body.historial.slice(-20) : []
    const history = historialRaw.map(m => ({
      role: m.rol === 'usuario' ? 'user' : 'model',
      parts: [{ text: sanitizePromptInput(m.texto, 2000) }],
    }))

    const systemPrompt = `Eres un asistente clínico de referencia rápida para médicos en México. Responde consultas de cualquier especialidad médica de forma directa y estructurada.

CONTEXTO GEOGRÁFICO — OBLIGATORIO:
• Todas las respuestas deben estar contextualizadas para México.
• Para medicamentos, tu primera fuente de referencia es el PLM México (Diccionario de Especialidades Farmacéuticas, edición México).
• Usa únicamente nombres comerciales disponibles en México. Nunca uses nombres de España, Argentina u otros países.
• Las guías clínicas que menciones deben ser de CENETEC, SSa, IMSS, ISSSTE o guías internacionales de uso habitual en México.

FORMATO DE RESPUESTA — MUY IMPORTANTE:
• NO uses sintaxis Markdown. Nada de asteriscos (**), almohadillas (##), guiones como viñetas (-) ni ningún símbolo de formato Markdown.
• El texto debe quedar limpio al copiarlo y pegarlo directamente en una nota clínica.
• Usa emojis como viñetas visuales: 💊 para medicamentos, 📋 para listas, ✅ para puntos clave, ⚠️ para advertencias, 🔹 para subitems.
• Usa MAYÚSCULAS para los encabezados de sección, seguidos de dos puntos.
• Usa saltos de línea simples para separar secciones.
• Sé conciso: máximo 10-12 líneas. Ve directo al dato, sin introducción ni cierre.

PARA MEDICAMENTOS:
💊 Nombre genérico (Nombre comercial en México)
📋 Dosis: [dosis] | Vía: [vía] | Frecuencia: [frecuencia] | Duración: [duración]
⚠️ [advertencia relevante si aplica]

PARA ESCALAS O CLASIFICACIONES:
Nombre de la escala, luego ítems con 🔹 y puntuación/interpretación al final.

PARA PROCEDIMIENTOS:
Descripción concisa con pasos numerados y hallazgo positivo.

Responde siempre en español con lenguaje médico formal.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    })
    const chat = model.startChat({ history })
    const response = await chat.sendMessage(pregunta)
    const respuesta = response.response.text()
    return NextResponse.json({ respuesta })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
