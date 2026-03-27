'use client'

import { useState, useEffect } from 'react'

export type ClinicaConfig = {
  id: string
  nombre: string
  nombre_display: string | null
  subtitulo: string | null
  color_primario: string | null
  color_secundario: string | null
  logo_url: string | null
}

export function useClinica() {
  const [clinica, setClinica] = useState<ClinicaConfig | null>(null)

  useEffect(() => {
    fetch('/api/me/clinica')
      .then(r => r.json())
      .then(({ clinica }) => setClinica(clinica))
  }, [])

  return {
    clinica,
    colorPrimario: clinica?.color_primario ?? '#1a3a5c',
    colorSecundario: clinica?.color_secundario ?? '#1e5fa8',
    nombreDisplay: clinica?.nombre_display ?? 'Dr. Angel M. Ancona Pérez',
    subtitulo: clinica?.subtitulo ?? 'Cirugía de Columna · Traumatología',
    logoUrl: clinica?.logo_url ?? null,
  }
}
