'use client'

import useSWR from 'swr'

export type ClinicaConfig = {
  id: string
  nombre: string
  nombre_display: string | null
  subtitulo: string | null
  color_primario: string | null
  color_secundario: string | null
  logo_url: string | null
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error('Error al cargar clínica')
    return r.json()
  })

export function useClinica() {
  // SWR cachea la respuesta y la comparte entre todos los componentes
  // que usen el hook — sin queries duplicadas al servidor
  const { data } = useSWR<{ clinica: ClinicaConfig | null }>(
    '/api/me/clinica',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  const clinica = data?.clinica ?? null

  return {
    clinica,
    colorPrimario:  clinica?.color_primario  ?? '#1a3a5c',
    colorSecundario: clinica?.color_secundario ?? '#1e5fa8',
    nombreDisplay:  clinica?.nombre_display  ?? 'Dr. Angel M. Ancona Pérez',
    subtitulo:      clinica?.subtitulo       ?? 'Cirugía de Columna · Traumatología',
    logoUrl:        clinica?.logo_url        ?? null,
  }
}
