'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useCatalogoAnalitos } from '@/hooks/useCatalogoAnalitos'
import type { AnalitoCatalogo, CategoriaAnalito } from '@/types'

export interface AnalitoRastreado {
  analitoId: string | null
  nombreCustom: string | null
  unidadCustom: string | null
  categoriaCustom: string | null
  clave: string
  nombre: string
  unidad: string
  categoria: CategoriaAnalito | string
  ultimoValor: number
  ultimoMedidoEn: string
  cantidadMediciones: number
}

type MedicionRow = {
  analito_id: string | null
  nombre_custom: string | null
  unidad_custom: string | null
  categoria_custom: string | null
  valor: number
  medido_en: string
}

async function fetchMediciones(pacienteId: string): Promise<MedicionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mediciones_analitos')
    .select('analito_id, nombre_custom, unidad_custom, categoria_custom, valor, medido_en')
    .eq('paciente_id', pacienteId)
    .order('medido_en', { ascending: false })

  if (error) throw error
  return (data ?? []) as MedicionRow[]
}

function claveCustom(nombre: string): string {
  return `custom:${nombre.trim().toLowerCase()}`
}

function agrupar(rows: MedicionRow[], catalogo: AnalitoCatalogo[]): AnalitoRastreado[] {
  const catalogoById = new Map(catalogo.map(a => [a.id, a]))
  type Acc = {
    analitoId: string | null
    nombreCustom: string | null
    unidadCustom: string | null
    categoriaCustom: string | null
    mediciones: MedicionRow[]
  }
  const grupos = new Map<string, Acc>()

  for (const r of rows) {
    let clave: string
    if (r.analito_id) {
      clave = `a:${r.analito_id}`
    } else if (r.nombre_custom) {
      clave = claveCustom(r.nombre_custom)
    } else {
      continue
    }

    const existing = grupos.get(clave)
    if (existing) {
      existing.mediciones.push(r)
    } else {
      grupos.set(clave, {
        analitoId: r.analito_id,
        nombreCustom: r.nombre_custom,
        unidadCustom: r.unidad_custom,
        categoriaCustom: r.categoria_custom,
        mediciones: [r],
      })
    }
  }

  const resultado: AnalitoRastreado[] = []
  for (const [clave, acc] of grupos.entries()) {
    const ordenadas = acc.mediciones
    const ultimo = ordenadas[0]
    if (!ultimo) continue

    let nombre: string
    let unidad: string
    let categoria: CategoriaAnalito | string

    if (acc.analitoId) {
      const cat = catalogoById.get(acc.analitoId)
      if (!cat) continue
      nombre = cat.nombre
      unidad = cat.unidad
      categoria = cat.categoria
    } else if (acc.nombreCustom) {
      nombre = acc.nombreCustom
      unidad = acc.unidadCustom ?? ''
      categoria = acc.categoriaCustom ?? 'otros'
    } else {
      continue
    }

    resultado.push({
      analitoId: acc.analitoId,
      nombreCustom: acc.nombreCustom,
      unidadCustom: acc.unidadCustom,
      categoriaCustom: acc.categoriaCustom,
      clave,
      nombre,
      unidad,
      categoria,
      ultimoValor: Number(ultimo.valor),
      ultimoMedidoEn: ultimo.medido_en,
      cantidadMediciones: ordenadas.length,
    })
  }

  resultado.sort((a, b) => {
    if (a.categoria !== b.categoria) {
      return String(a.categoria).localeCompare(String(b.categoria))
    }
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  return resultado
}

export function useAnalitosRastreados(pacienteId: string | undefined) {
  const { analitos: catalogo, isLoading: catalogoLoading, error: catalogoError } = useCatalogoAnalitos()

  const { data, error, isLoading, mutate } = useSWR<MedicionRow[]>(
    pacienteId ? ['analitos-rastreados', pacienteId] : null,
    () => fetchMediciones(pacienteId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  )

  const analitos = useMemo(
    () => (data && !catalogoLoading ? agrupar(data, catalogo) : []),
    [data, catalogo, catalogoLoading],
  )

  return {
    analitos,
    isLoading: isLoading || catalogoLoading,
    error: error ?? catalogoError,
    mutate,
  }
}
