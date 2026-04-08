import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizePromptInput, sanitizeNumber } from '@/lib/sanitize'
import { anonimizarTexto } from '@/lib/anonimizar'

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

    // Sanitizar inputs + anonimizar PII antes de enviar a Gemini.
    // LFPDPPP Art. 9: datos de salud son sensibles y requieren minimización
    // al compartir con terceros (Google Gemini). Se preservan datos clínicos
    // (síntomas, signos, diagnósticos) pero se redactan nombres, IDs, contacto.
    const motivo_consulta       = anonimizarTexto(sanitizePromptInput(body.motivo_consulta, 1000))
    const exploracion_fisica    = anonimizarTexto(sanitizePromptInput(body.exploracion_fisica, 1000))
    const diagnosticos          = anonimizarTexto(sanitizePromptInput(body.diagnosticos, 500))
    const plan_tratamiento      = anonimizarTexto(sanitizePromptInput(body.plan_tratamiento, 500))
    const gabinete_laboratorios = anonimizarTexto(sanitizePromptInput(body.gabinete_laboratorios, 1000))
    const antecedentes          = anonimizarTexto(sanitizePromptInput(body.antecedentes, 500))
    const edad             = sanitizeNumber(body.edad)
    const peso             = sanitizeNumber(body.peso)
    const talla            = sanitizeNumber(body.talla)
    const sexo             = ['M', 'F'].includes(body.sexo) ? body.sexo as 'M' | 'F' : null

    const prompt = `Actúa como un Médico Especialista en ${especialidad}. Tu objetivo es redactar una nota médica profesional, precisa y estructurada con el "Equilibrio Dorado": completa para fines legales/médicos, sin narrativa innecesaria.

Adapta TODA la nota al contexto clínico de "${especialidad}": usa la terminología técnica, las maniobras semiológicas, las escalas de valoración, los estudios de gabinete y los enfoques terapéuticos propios de esa especialidad. Por ejemplo:
- Ortopedia/Columna → arcos de movilidad, escalas ASIA/Daniels, imagenología musculoesquelética
- Cardiología → ruidos cardíacos, hemodinamia, FEVI, ECG, troponinas
- Neurología → pares craneales, reflejos, escala de Glasgow/NIHSS, neuroimagen
- Gastroenterología → peristaltismo, signos de irritación peritoneal, endoscopia, enzimas hepáticas
- Y así para cada especialidad: prioriza lo que un experto en "${especialidad}" evaluaría y documentaría.

REGLAS DE REDACCIÓN:
1. ESTILO CLÍNICO: Frases directas en tercera persona. Evita "el paciente dice que"; prefiere "Refiere cuadro de [X] de [tiempo] de evolución".
2. LATERALIDAD: Cuando aplique a la especialidad, indica lateralidad en MAYÚSCULAS (DERECHO/IZQUIERDO). Si no se menciona, escribe "lateralidad no especificada".
3. INTEGRACIÓN: Describe hallazgos con contexto clínico breve, no los listes de forma aislada.
4. NO incluyas título, encabezado, nombre del paciente, fecha, médico tratante, cédula ni ningún dato administrativo.
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
Motivo de consulta y padecimiento actual con cronología. Síntomas referidos y antecedentes relevantes para la especialidad ${especialidad}.

**[OBJETIVO]:**
Exploración física detallada con las maniobras, escalas de valoración y hallazgos semiológicos propios de la especialidad ${especialidad}. Da formato a los signos vitales si se proporcionaron.

**[AUXILIARES DIAGNÓSTICOS]:**
Interpretación técnica de los estudios de gabinete y laboratorio pertinentes para ${especialidad}. Si no se proporcionaron estudios, escribe: "Estudios de gabinete y laboratorio pendientes."

**[ANÁLISIS]:**
Diagnóstico clínico preciso con terminología de la especialidad ${especialidad}. Incluye diagnóstico diferencial si aplica, lateralidad en MAYÚSCULAS y clasificación o estadificación cuando corresponda.

**[PLAN]:**
PROHIBIDO mencionar medicamentos, fármacos, nombres comerciales, denominaciones genéricas, dosis, vía de administración, frecuencia ni duración de ningún tratamiento farmacológico. El médico los registra por separado en el apartado de Terapéutica Empleada.
Incluye ÚNICAMENTE: indicaciones no farmacológicas pertinentes para la especialidad ${especialidad} (rehabilitación, restricciones funcionales, dieta, procedimientos, interconsultas, vigilancia de signos de alarma, etc.) y cronograma de seguimiento o próxima valoración.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const response = await model.generateContent(prompt)
    const nota = response.response.text()
    return NextResponse.json({ nota })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al generar la nota'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
