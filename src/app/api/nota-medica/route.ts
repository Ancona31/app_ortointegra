import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      paciente,
      motivo_consulta,
      exploracion_fisica,
      diagnosticos,
      plan_tratamiento,
      antecedentes,
      edad,
      sexo,
      peso,
      talla,
    } = body

    const prompt = `Eres el Dr. Angel M. Ancona Pérez, Cirujano de Columna Vertebral y Traumatólogo Ortopedista.

Redacta una nota médica de consulta de ortopedia y traumatología en español, con lenguaje clínico formal y profesional.

Datos del paciente:
- Nombre: ${paciente}
- Edad: ${edad || 'no especificada'}
- Sexo: ${sexo || 'no especificado'}
- Peso: ${peso ? peso + ' kg' : 'no especificado'}
- Talla: ${talla ? talla + ' cm' : 'no especificada'}
${antecedentes ? `- Antecedentes relevantes: ${antecedentes}` : ''}

Información de la consulta:
- Motivo de consulta: ${motivo_consulta}
${exploracion_fisica ? `- Exploración física proporcionada: ${exploracion_fisica}` : ''}
${diagnosticos ? `- Diagnóstico(s): ${diagnosticos}` : ''}
${plan_tratamiento ? `- Plan de tratamiento indicado: ${plan_tratamiento}` : ''}

Redacta la nota médica completa con las siguientes secciones claramente delimitadas:

**MOTIVO DE CONSULTA:**
[Redactar]

**ANTECEDENTES RELEVANTES:**
[Redactar basándote en los datos proporcionados]

**EXPLORACIÓN FÍSICA:**
[Redactar de forma detallada y clínica. Si no se proporcionaron datos, incluye hallazgos típicos para el diagnóstico]

**DIAGNÓSTICO:**
[Redactar con terminología médica precisa]

**PLAN DE TRATAMIENTO:**
[Redactar de forma ordenada y completa]

**PRONÓSTICO:**
[Redactar un pronóstico apropiado]

Usa terminología médica ortopédica correcta. La nota debe sonar como escrita por un especialista en columna y traumatología. Sé específico y clínico.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const nota = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ nota })

  } catch (err: any) {
    console.error('Error generando nota:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
