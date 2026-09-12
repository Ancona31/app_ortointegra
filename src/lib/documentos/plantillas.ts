/**
 * Plantillas de documento — acceso a `public.plantillas_documento`.
 *
 * Fuente de verdad: GUIA_FORMULARIOS_02_PLANTILLAS.md.
 * Esquema: supabase/migrations/20260810_plantillas_documento.sql.
 *
 * El proyecto no genera tipos de la base, así que la fila se escribe a mano.
 * Si la tabla cambia, este archivo es lo único que hay que ajustar.
 */

import { createClient } from '@/lib/supabase/client'

/** Los ocho formatos, con los nombres exactos de `plantillas_documento_tipo_check`. */
export const TIPOS_PLANTILLA = [
  'receta',
  'solicitud_lab',
  'solicitud_imagen',
  'plan_suplementacion',
  'solicitud_internamiento',
  'escrito_medico',
  'consentimiento_informado',
  'nota_honorarios',
] as const

export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number]

/** Tope por médico y tipo. Lo impone el trigger; el cliente da el mensaje bueno. */
export const TOPE_PLANTILLAS = 10

/** Límite de la spec (§0). La columna admite 60; el formulario corta en 40. */
export const MAX_NOMBRE = 40

export interface PlantillaDocumento {
  id: string
  tipo: TipoPlantilla
  nombre: string
  contenido: Record<string, unknown>
  updated_at: string
}

/** En minúscula: entra en «Plantillas de {tipo}» y «Sin plantillas de {tipo}». */
export const ETIQUETA_TIPO: Record<TipoPlantilla, string> = {
  receta: 'receta',
  solicitud_lab: 'laboratorio',
  solicitud_imagen: 'imagen',
  plan_suplementacion: 'suplementación',
  solicitud_internamiento: 'internamiento',
  escrito_medico: 'escrito médico',
  consentimiento_informado: 'consentimiento',
  nota_honorarios: 'honorarios',
}

const COLUMNAS = 'id, tipo, nombre, contenido, updated_at'

/**
 * Espacio, tabulador, retorno, salto de línea y espacio duro: el MISMO juego de
 * caracteres que el `btrim` de la migración. El espacio duro llega al pegar
 * desde un procesador de textos y `String.trim()` no lo quita.
 */
const BORDES = /^[ \t\r\n\u00A0]+|[ \t\r\n\u00A0]+$/g

/** Recorta como recorta la base antes de guardar. */
export function recortarNombre(nombre: string): string {
  return nombre.replace(BORDES, '')
}

/**
 * Clave de comparación de nombres, idéntica al índice único de la base:
 * `lower(btrim(nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160)))`.
 *
 * La igualdad exacta —lo que hacía el sistema viejo de honorarios— deja escapar
 * «Prequirúrgico» contra «prequirúrgico»: el cliente no avisa, y el médico
 * recibe el 23505 crudo de la base en la cara.
 */
export function normalizarNombre(nombre: string): string {
  return recortarNombre(nombre).toLowerCase()
}

/** La plantilla que colisionaría con `nombre`, o null. `exceptoId` es la que se renombra. */
export function colisionDeNombre(
  lista: readonly PlantillaDocumento[],
  nombre: string,
  exceptoId?: string,
): PlantillaDocumento | null {
  const clave = normalizarNombre(nombre)
  if (clave === '') return null
  return lista.find(p => p.id !== exceptoId && normalizarNombre(p.nombre) === clave) ?? null
}

function codigoDe(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

/** El trigger del tope lanza `check_violation`. */
export function esErrorDeTope(err: unknown): boolean {
  return codigoDe(err) === '23514'
}

/** Red del índice único: la carrera entre dos pestañas que el cliente no ve. */
export function esErrorDeNombreDuplicado(err: unknown): boolean {
  return codigoDe(err) === '23505'
}

export async function listarPlantillas(tipo: TipoPlantilla): Promise<PlantillaDocumento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('plantillas_documento')
    .select(COLUMNAS)
    .eq('tipo', tipo)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PlantillaDocumento[]
}

/**
 * INSERT liso, sin `upsert` ni `onConflict`: los triggers BEFORE INSERT disparan
 * ANTES de que Postgres arbitre el conflicto, así que una inserción con
 * resolución de conflicto sobre la décima plantilla lanzaría el tope en vez de
 * actualizar. Sobrescribir es `sobrescribirPlantilla`, por id.
 */
export async function crearPlantilla(
  tipo: TipoPlantilla,
  nombre: string,
  contenido: Record<string, unknown>,
): Promise<PlantillaDocumento> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data, error } = await supabase
    .from('plantillas_documento')
    .insert({ user_id: user.id, tipo, nombre: recortarNombre(nombre), contenido })
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return data as PlantillaDocumento
}

export async function sobrescribirPlantilla(
  id: string,
  contenido: Record<string, unknown>,
): Promise<PlantillaDocumento> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('plantillas_documento')
    .update({ contenido })
    .eq('id', id)
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return data as PlantillaDocumento
}

export async function renombrarPlantilla(id: string, nombre: string): Promise<PlantillaDocumento> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('plantillas_documento')
    .update({ nombre: recortarNombre(nombre) })
    .eq('id', id)
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return data as PlantillaDocumento
}

export async function eliminarPlantilla(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('plantillas_documento').delete().eq('id', id)
  if (error) throw error
}
