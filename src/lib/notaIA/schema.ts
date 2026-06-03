import { SchemaType, type ResponseSchema } from '@google/generative-ai'
import type { Diagnostico } from '@/types'

/**
 * Contrato de la salida JSON del modo IA de Nueva Nota Médica (SF0).
 * Módulo neutro: solo tipos + responseSchema. Sin runtime ni side effects.
 * El responseSchema de Gemini NO soporta uniones (oneOf): ambos campos
 * (preguntas y nota) van siempre presentes; `status` es el discriminador plano.
 */

// ---------- Tipos TypeScript del contrato ----------

export interface PreguntaIA {
  id: string
  pregunta: string
  opciones: string[]
  permite_texto_libre: boolean
}

export interface NotaEstructurada {
  motivo_consulta: string
  exploracion_fisica: string
  plan_tratamiento: string
  diagnosticos: Diagnostico[]
}

export interface NotaIAContenido {
  narrativa: string
  estructurado: NotaEstructurada
}

export interface NotaIAResponse {
  status: 'completa' | 'faltan_datos'
  preguntas: PreguntaIA[] // [] cuando status === 'completa'
  nota: NotaIAContenido | null // null cuando status === 'faltan_datos'
}

// ---------- responseSchema de Gemini (mismo shape, sin oneOf) ----------

export const notaIAResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    status: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['completa', 'faltan_datos'],
    },
    preguntas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          pregunta: { type: SchemaType.STRING },
          opciones: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          permite_texto_libre: { type: SchemaType.BOOLEAN },
        },
        required: ['id', 'pregunta', 'opciones', 'permite_texto_libre'],
      },
    },
    nota: {
      type: SchemaType.OBJECT,
      nullable: true, // null cuando faltan datos; ver decisión en el reporte
      properties: {
        narrativa: { type: SchemaType.STRING },
        estructurado: {
          type: SchemaType.OBJECT,
          properties: {
            motivo_consulta: { type: SchemaType.STRING },
            exploracion_fisica: { type: SchemaType.STRING },
            plan_tratamiento: { type: SchemaType.STRING },
            diagnosticos: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  codigo_cie10: { type: SchemaType.STRING },
                  descripcion: { type: SchemaType.STRING },
                },
                required: ['descripcion'], // codigo_cie10 es opcional
              },
            },
          },
          required: ['motivo_consulta', 'exploracion_fisica', 'plan_tratamiento', 'diagnosticos'],
        },
      },
      required: ['narrativa', 'estructurado'],
    },
  },
  required: ['status', 'preguntas'],
}
