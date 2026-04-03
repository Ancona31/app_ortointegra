import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizePromptInput, sanitizeNumber } from '@/lib/sanitize'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const limitError = await checkRateLimit(user.id, 'nota-medica')
    if (limitError) return limitError

    // Obtener especialidad del médico autenticado
    const { data: profile } = await supabase
      .from('profiles')
      .select('especialidad')
      .eq('id', user.id)
      .single()
    const especialidad = profile?.especialidad?.trim() || 'Medicina General'

    const body = await req.json()

    // Sanitizar todos los inputs antes de interpolarlos en el prompt
    const motivo_consulta       = sanitizePromptInput(body.motivo_consulta, 1000)
    const exploracion_fisica    = sanitizePromptInput(body.exploracion_fisica, 1000)
    const diagnosticos          = sanitizePromptInput(body.diagnosticos, 500)
    const plan_tratamiento      = sanitizePromptInput(body.plan_tratamiento, 500)
    const gabinete_laboratorios = sanitizePromptInput(body.gabinete_laboratorios, 1000)
    const antecedentes          = sanitizePromptInput(body.antecedentes, 500)
    const edad             = sanitizeNumber(body.edad)
    const peso             = sanitizeNumber(body.peso)
    const talla            = sanitizeNumber(body.talla)
    const sexo             = ['M', 'F'].includes(body.sexo) ? body.sexo as 'M' | 'F' : null

    const prompt = `Eres un Médico Especialista en ${especialidad} actuando como asistente de documentación clínica. Tu objetivo es redactar notas médicas con el "Equilibrio Dorado": completas para fines legales/médicos, pero sin narrativa innecesaria.

Adapta TODA la nota al contexto clínico de la especialidad "${especialidad}": usa la terminología, las maniobras exploratorias, los estudios de gabinete y los esquemas terapéuticos propios de esa especialidad.

REGLAS DE REDACCIÓN:
1. LATERALIDAD: Identifica y resalta SIEMPRE la lateralidad en MAYÚSCULAS (DERECHO/IZQUIERDO) cuando aplique a la especialidad. Si no se menciona, indícalo como "lateralidad no especificada".
2. ESTILO CLÍNICO: Usa frases completas pero directas. Evita "El paciente dice que...", prefiere "Refiere cuadro de [X] tiempo de evolución...".
3. INTEGRACIÓN: No solo listes hallazgos; descríbelos brevemente (ej. en lugar de "Dolor", usa "Dolor de tipo punzante que exacerba con la deambulación").
4. NO incluyas título, encabezado, nombre del paciente, fecha, médico tratante, cédula, ni ningún dato administrativo. Esos datos ya están en el documento impreso.
5. NO agregues introducciones, cierres ni firmas. Inicia DIRECTAMENTE con [SUBJETIVO].

DATOS CLÍNICOS DEL PACIENTE:
- Edad: ${edad ? edad + ' años' : 'no especificada'}
- Sexo: ${sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'no especificado'}
- Peso: ${peso ? peso + ' kg' : 'no especificado'} | Talla: ${talla ? talla + ' cm' : 'no especificada'}
${antecedentes ? `- Antecedentes: ${antecedentes}` : ''}

DATOS DE LA CONSULTA:
${motivo_consulta ? `- Motivo / padecimiento actual: ${motivo_consulta}` : ''}
${exploracion_fisica ? `- Exploración física: ${exploracion_fisica}` : ''}
${diagnosticos ? `- Diagnóstico(s): ${diagnosticos}` : ''}
${gabinete_laboratorios ? `- Gabinete y laboratorios: ${gabinete_laboratorios}` : ''}
${plan_tratamiento ? `- Plan: ${plan_tratamiento}` : ''}

FORMATO DE SALIDA — usa exactamente estas 5 secciones, sin agregar nada más antes ni después:

**[SUBJETIVO]:**
Antecedentes del trauma o padecimiento actual, mecanismo de lesión y síntomas referidos con su cronología.

**[OBJETIVO]:**
Exploración física detallada. Incluye arcos de movilidad, fuerza muscular (escala de Daniels), estado neurovascular distal y maniobras especiales de la especialidad.

**[AUXILIARES DIAGNÓSTICOS]:**
Interpretación técnica de estudios de gabinete (Rx, RM, TAC) y laboratorios relevantes. Si no se proporcionaron estudios, escribe: "Estudios de gabinete y laboratorio pendientes."

**[ANÁLISIS]:**
Diagnóstico clínico y radiológico preciso, incluyendo lateralidad en MAYÚSCULAS y clasificación si aplica.

**[PLAN]:**
PROHIBIDO mencionar medicamentos, fármacos, nombres comerciales, denominaciones genéricas, dosis, vía de administración, frecuencia ni duración de ningún tratamiento farmacológico. El médico los registra por separado en el apartado de Terapéutica Empleada. Incluye ÚNICAMENTE: indicaciones no farmacológicas (reposo, descarga de peso, inmovilización, uso de órtesis, terapia física, rehabilitación, cuidados locales, dieta, etc.) y cronograma de seguimiento o próxima valoración.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const response = await model.generateContent(prompt)
    const nota = response.response.text()
    return NextResponse.json({ nota })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno al generar la nota' }, { status: 500 })
  }
}
