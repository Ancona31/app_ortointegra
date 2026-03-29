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

    const prompt = `Actúa como un Médico Especialista en Traumatología y Ortopedia con Alta Especialidad en Cirugía de Columna. Redacta ÚNICAMENTE el cuerpo clínico de la nota médica en formato SOAP, con rigor técnico y legal (NOM-004-SSA3-2012).

REGLAS ESTRICTAS DE FORMATO:
- NO incluyas título, encabezado, nombre del paciente, fecha, médico tratante, cédula, ni ningún dato administrativo. Esos datos ya están en el documento impreso.
- NO uses líneas en blanco con guiones o subrayados (___).
- NO agregues secciones de "Médico que atiende" ni firmas.
- Inicia DIRECTAMENTE con la primera sección SOAP.
- Usa terminología ortopédica precisa: "hipoestesia en dermatoma L5", "claudicación neurógena", "signo de Spurling positivo", etc.
- Cuando haya dolor axial, incluye ROT, fuerza muscular (Escala de Daniels) y sensibilidad aunque los datos sean breves.
- Conciso y "scannable". Sin frases de relleno.
- El pronóstico SIEMPRE termina con "para la vida y para la función".
- Incluye código CIE-10 si es evidente.

DATOS CLÍNICOS DEL PACIENTE:
- Edad: ${edad ? edad + ' años' : 'no especificada'}
- Sexo: ${sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'no especificado'}
- Peso: ${peso ? peso + ' kg' : 'no especificado'} | Talla: ${talla ? talla + ' cm' : 'no especificada'}
${antecedentes ? `- Antecedentes: ${antecedentes}` : ''}

DATOS DE LA CONSULTA:
${motivo_consulta ? `- Motivo / dictado: ${motivo_consulta}` : ''}
${exploracion_fisica ? `- Exploración física: ${exploracion_fisica}` : ''}
${diagnosticos ? `- Diagnóstico(s): ${diagnosticos}` : ''}
${gabinete_laboratorios ? `- Gabinete y laboratorios: ${gabinete_laboratorios}` : ''}
${plan_tratamiento ? `- Plan: ${plan_tratamiento}` : ''}

FORMATO DE SALIDA — usa exactamente estas 5 secciones, sin agregar nada más antes ni después:

**S (Subjetivo):**
[Padecimiento actual, mecanismo de lesión, EVA del dolor]

**O (Objetivo):**
[Inspección, palpación, arcos de movilidad, maniobras especiales, estado neurovascular distal, ROT, Daniels, sensibilidad]

**A (Análisis / Diagnóstico):**
[Diagnóstico(s) con CIE-10]

**P (Plan):**
[Plan terapéutico, higiene de columna/articular, signos de alarma]

**Pronóstico:**
[Pronóstico para la vida y para la función]`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const response = await model.generateContent(prompt)
    const nota = response.response.text()
    return NextResponse.json({ nota })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno al generar la nota' }, { status: 500 })
  }
}
