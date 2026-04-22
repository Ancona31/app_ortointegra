'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Documento } from '@/types'

async function fetchDocumentosLabs(pacienteId: string): Promise<Documento[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('documentos')
    .select(
      'id, paciente_id, consulta_id, tipo, contenido, pdf_url, storage_bucket, storage_path, mime_type, tamaño_bytes, nombre_original, subido_por, created_at',
    )
    .eq('paciente_id', pacienteId)
    .in('tipo', ['resultado_laboratorio', 'estudio_imagen'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Documento[]
}

export function useDocumentosLabs(pacienteId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Documento[]>(
    pacienteId ? ['documentos-labs', pacienteId] : null,
    () => fetchDocumentosLabs(pacienteId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  )

  return {
    documentos: data ?? [],
    isLoading,
    error,
    mutate,
  }
}
