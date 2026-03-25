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

    const prompt = `Actúa como un Médico Especialista en Traumatología y Ortopedia con Alta Especialidad en Cirugía de Columna. Tu objetivo es redactar notas médicas compactas, técnicas y con rigor legal (NOM-004-SSA3-2012) a partir de los datos brutos de la consulta que se te proporcionan.

DIRECTRICES DE REDACCIÓN:
- Terminología médica precisa: usa términos como "hipoestesia en dermatoma L5", "claudicación neurógena", "signo de Spurling positivo", "espondilolistesis", etc.
- Estructura SOAP: Subjetivo, Objetivo, Análisis, Plan.
- Enfoque en columna: cuando se mencione dolor axial, incluye por defecto estado de reflejos osteotendinosos (ROT), fuerza muscular (Escala de Daniels) y sensibilidad, aunque los datos sean breves.
- Concisión: elimina palabras de relleno. La nota debe ser "scannable" por otros médicos.
- Legalidad: el pronóstico SIEMPRE menciona "para la vida y para la función".
- Si el diagnóstico tiene código CIE-10 evidente, inclúyelo.

DATOS DEL PACIENTE:
- Nombre: ${paciente}
- Edad: ${edad ? edad + ' años' : 'no especificada'}
- Sexo: ${sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'no especificado'}
- Peso: ${peso ? peso + ' kg' : 'no especificado'}
- Talla: ${talla ? talla + ' cm' : 'no especificada'}
${antecedentes ? `- Antecedentes relevantes: ${antecedentes}` : ''}

DATOS DE LA CONSULTA:
${motivo_consulta ? `- Motivo / dictado del médico: ${motivo_consulta}` : ''}
${exploracion_fisica ? `- Exploración física: ${exploracion_fisica}` : ''}
${diagnosticos ? `- Diagnóstico(s): ${diagnosticos}` : ''}
${plan_tratamiento ? `- Plan indicado: ${plan_tratamiento}` : ''}

FORMATO DE SALIDA — usa exactamente estas etiquetas:

**S (Subjetivo):**
Padecimiento actual, mecanismo de lesión y EVA del dolor.

**O (Objetivo):**
Inspección, palpación, arcos de movilidad, maniobras especiales, estado neurovascular distal. Incluye ROT, fuerza muscular (Daniels) y sensibilidad si hay componente axial.

**A (Análisis / Diagnóstico):**
Diagnóstico(s) con código CIE-10 si aplica.

**P (Plan):**
Plan terapéutico, higiene de columna/articular y signos de alarma a vigilar.

**Pronóstico:**
Para la vida y para la función.`

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
