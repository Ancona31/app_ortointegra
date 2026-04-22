import { useState, useEffect, useMemo, useCallback } from 'react'
import { parseISO, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Laboratorio } from '@/types'

const QUERY_LIMIT = 50

// Palabras que no distinguen el parámetro clínico (se ignoran al agrupar)
const QUALIFIERS_IGNORAR = new Set([
  'serica','serico','sericas','sericos',
  'basal','en','ayunas','simple','total','completo','completa',
  'plasmatica','plasmatico','venosa','venoso','capilar','capilary',
  'sangre','sanguinea','sanguineo','urinaria','urinario',
  'de','la','el','los','las','y','o',
])

export function normalizarKey(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')      // quitar puntuación
    .split(/\s+/)
    .filter(w => w.length >= 2 && !QUALIFIERS_IGNORAR.has(w))
    .join(' ')
    .trim()
}

type PuntoGrafica = { fechaLabel: string; fechaISO: string; valor: number; estado?: string }
export type ParamGrafica = {
  nombre: string
  aliases: string[]
  unidad: string
  rango_ref?: string
  rango_optimo?: string
  puntos: PuntoGrafica[]
}

export function useLaboratoriosNormalizados(pacienteId: string) {
  const [labs, setLabs] = useState<Laboratorio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('laboratorios')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_toma', { ascending: false })
      .limit(QUERY_LIMIT)
    if (err) setError(true)
    setLabs((data ?? []) as Laboratorio[])
  }, [pacienteId])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    setLoading(true)
    setError(false)

    supabase
      .from('laboratorios')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_toma', { ascending: false })
      .limit(QUERY_LIMIT)
      .then((res: { data: Laboratorio[] | null; error: unknown }) => {
        if (cancelled) return
        if (res.error) setError(true)
        setLabs((res.data ?? []) as Laboratorio[])
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [pacienteId])

  // Recolecta todos los parámetros de todos los labs agrupando nombres equivalentes
  const todosLosParams = useMemo((): ParamGrafica[] => {
    const map = new Map<string, {
      nombres: Map<string, number>
      unidad: string
      rango_ref?: string
      rango_optimo?: string
      puntos: { fechaLabel: string; fechaISO: string; valor: number; estado?: string }[]
    }>()

    const labsOrdenados = [...labs].sort((a, b) => a.fecha_toma.localeCompare(b.fecha_toma))

    labsOrdenados.forEach(lab => {
      ;(lab.resultados || []).forEach(r => {
        const val = typeof r.valor === 'number' ? r.valor : parseFloat(String(r.valor))
        if (isNaN(val)) return

        const nombreOriginal = r.nombre.trim()
        const key = normalizarKey(nombreOriginal)
        if (!key) return

        if (!map.has(key)) {
          map.set(key, {
            nombres: new Map(),
            unidad: r.unidad || '',
            rango_ref: r.rango_ref,
            rango_optimo: r.rango_optimo,
            puntos: [],
          })
        }
        const grupo = map.get(key)!
        grupo.nombres.set(nombreOriginal, (grupo.nombres.get(nombreOriginal) || 0) + 1)
        if (!grupo.rango_ref && r.rango_ref) grupo.rango_ref = r.rango_ref
        if (!grupo.rango_optimo && r.rango_optimo) grupo.rango_optimo = r.rango_optimo
        grupo.puntos.push({
          fechaLabel: format(parseISO(lab.fecha_toma), 'dd/MM/yy'),
          fechaISO: lab.fecha_toma,
          valor: val,
          estado: r.estado,
        })
      })
    })

    return Array.from(map.values())
      .map(g => {
        const nombrePrincipal = Array.from(g.nombres.entries())
          .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
        const aliases = Array.from(g.nombres.keys()).filter(n => n !== nombrePrincipal)
        return {
          nombre: nombrePrincipal,
          aliases,
          unidad: g.unidad,
          rango_ref: g.rango_ref,
          rango_optimo: g.rango_optimo,
          puntos: g.puntos,
        }
      })
      .sort((a, b) => {
        if (b.puntos.length !== a.puntos.length) return b.puntos.length - a.puntos.length
        return a.nombre.localeCompare(b.nombre)
      })
  }, [labs])

  return { labs, todosLosParams, loading, error, refetch }
}
