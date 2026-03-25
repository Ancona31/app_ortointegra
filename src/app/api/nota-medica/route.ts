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
