import { Type, type Schema } from '@google/genai'
import type { Diagnostico } from '@/types'

/**
 * Contrato de la salida JSON del modo IA de Nueva Nota Médica (SF0).
 * Módulo neutro: solo tipos + responseSchema. Sin runtime ni side effects.
 * El responseSchema de Gemini NO soporta uniones (oneOf): ambos campos
 * (bloques y nota) van siempre presentes; `status` es el discriminador plano.
 */

// ---------- Tipos TypeScript del contrato ----------

export interface PreguntaBloque {
  id: string
  pregunta: string
  opciones: string[]
  permite_texto_libre: boolean
}

export interface BloqueIA {
  titulo: string
  preguntas: PreguntaBloque[]
}

export interface MedicamentoIA {
  nombre: string
  dosis?: string
  frecuencia?: string
  duracion?: string
}

export interface NotaEstructurada {
  motivo_consulta: string
  exploracion_fisica: string
  plan_tratamiento: string
  diagnosticos: Diagnostico[]
  medicamentos: MedicamentoIA[]
}

export interface NotaIAContenido {
  narrativa: string
  estructurado: NotaEstructurada
}

export interface NotaIAResponse {
  status: 'completa' | 'faltan_datos'
  bloques: BloqueIA[] // [] cuando status === 'completa'; máx 3 bloques
  nota: NotaIAContenido | null // null cuando status === 'faltan_datos'
}

// ---------- responseSchema de Gemini (mismo shape, sin oneOf) ----------

export const notaIAResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      format: 'enum',
      enum: ['completa', 'faltan_datos'],
    },
    bloques: {
      type: Type.ARRAY, // máx 3 bloques (tope reforzado en el prompt, no en el schema)
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          preguntas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                pregunta: { type: Type.STRING },
                opciones: { type: Type.ARRAY, items: { type: Type.STRING } },
                permite_texto_libre: { type: Type.BOOLEAN },
              },
              required: ['id', 'pregunta', 'opciones', 'permite_texto_libre'],
            },
          },
        },
        required: ['titulo', 'preguntas'],
      },
    },
    nota: {
      type: Type.OBJECT,
      nullable: true, // null cuando faltan datos; ver decisión en el reporte
      properties: {
        narrativa: { type: Type.STRING },
        estructurado: {
          type: Type.OBJECT,
          properties: {
            motivo_consulta: { type: Type.STRING },
            exploracion_fisica: { type: Type.STRING },
            plan_tratamiento: { type: Type.STRING },
            diagnosticos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  codigo_cie10: { type: Type.STRING },
                  descripcion: { type: Type.STRING },
                },
                required: ['descripcion'], // codigo_cie10 es opcional
              },
            },
            medicamentos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  dosis: { type: Type.STRING },
                  frecuencia: { type: Type.STRING },
                  duracion: { type: Type.STRING },
                },
                required: ['nombre'], // solo nombre; dosis/frecuencia/duracion opcionales (IA omite lo que no sabe)
              },
            },
          },
          required: ['motivo_consulta', 'exploracion_fisica', 'plan_tratamiento', 'diagnosticos', 'medicamentos'],
        },
      },
      required: ['narrativa', 'estructurado'],
    },
  },
  required: ['status', 'bloques'],
}
