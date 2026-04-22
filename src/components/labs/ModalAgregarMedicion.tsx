'use client'

import { useState, useMemo } from 'react'
import { Activity, ArrowLeft } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import AutocompleteAnalito from '@/components/labs/AutocompleteAnalito'
import { useCatalogoAnalitos } from '@/hooks/useCatalogoAnalitos'
import { useToast } from '@/components/ui/Toast'
import {
  CATEGORIAS_ANALITO,
  MedicionCatalogoSchema,
  MedicionCustomSchema,
  MedicionTASchema,
} from '@/lib/labs/schemas'
import type { AnalitoCatalogo, CategoriaAnalito } from '@/types'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type Modo = 'catalogo' | 'custom'

const CATEGORIA_LABEL: Record<CategoriaAnalito, string> = {
  antropometria: 'Antropometría',
  signos_vitales: 'Signos vitales',
  hematologia: 'Hematología',
  quimica: 'Química',
  hueso: 'Hueso',
  endocrino: 'Endocrino',
  inmunologia: 'Inmunología',
  coagulacion: 'Coagulación',
  cardiaco: 'Cardíaco',
  marcador_tumoral: 'Marcadores tumorales',
  vitaminas_minerales: 'Vitaminas y minerales',
  otros: 'Otros',
}

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ahoraHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string
  onSuccess: () => void
}

export default function ModalAgregarMedicion({ open, onClose, pacienteId, onSuccess }: Props) {
  const { analitos, isLoading: catalogoLoading } = useCatalogoAnalitos()
  const toast = useToast()

  const [modo, setModo] = useState<Modo>('catalogo')
  const [analito, setAnalito] = useState<AnalitoCatalogo | null>(null)

  const [valor, setValor] = useState('')
  const [valorSistolica, setValorSistolica] = useState('')
  const [valorDiastolica, setValorDiastolica] = useState('')

  const [fecha, setFecha] = useState(hoyISO())
  const [hora, setHora] = useState(ahoraHHMM())
  const [notas, setNotas] = useState('')

  const [nombreCustom, setNombreCustom] = useState('')
  const [unidadCustom, setUnidadCustom] = useState('')
  const [categoriaCustom, setCategoriaCustom] = useState<CategoriaAnalito>('otros')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const esTA = useMemo(() => {
    if (!analito) return false
    return analito.clave === 'ta_sistolica' || analito.clave === 'ta_diastolica'
  }, [analito])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let payload: unknown
    if (modo === 'catalogo') {
      if (!analito) {
        setError('Selecciona un analito')
        return
      }
      if (esTA) {
        const parsed = MedicionTASchema.safeParse({
          tipo: 'ta',
          valorSistolica: Number(valorSistolica),
          valorDiastolica: Number(valorDiastolica),
          fecha,
          hora,
          notas: notas || undefined,
        })
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
          return
        }
        payload = { pacienteId, ...parsed.data }
      } else {
        const parsed = MedicionCatalogoSchema.safeParse({
          tipo: 'catalogo',
          analitoId: analito.id,
          valor: Number(valor),
          fecha,
          hora,
          notas: notas || undefined,
        })
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
          return
        }
        payload = { pacienteId, ...parsed.data }
      }
    } else {
      const parsed = MedicionCustomSchema.safeParse({
        tipo: 'custom',
        nombreCustom,
        unidadCustom,
        categoriaCustom,
        valor: Number(valor),
        fecha,
        hora,
        notas: notas || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
        return
      }
      payload = { pacienteId, ...parsed.data }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/labs/mediciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Error al guardar'
        setError(msg)
        setSubmitting(false)
        return
      }
      toast.success('Medición guardada')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de red'
      setError(msg)
      setSubmitting(false)
    }
  }

  const botonLabel = submitting ? 'Guardando…' : 'Guardar'

  const footer = (
    <div className="flex items-center justify-between gap-2 px-5 py-3">
      {modo === 'custom' ? (
        <button
          type="button"
          onClick={() => { setModo('catalogo'); setError(null) }}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
          disabled={submitting}
        >
          <ArrowLeft size={12} />
          Volver al catálogo
        </button>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="form-agregar-medicion"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-[13px] font-medium hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          {botonLabel}
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Agregar medición"
      subtitle={modo === 'custom' ? 'Analito personalizado' : 'Desde catálogo clínico'}
      icon={<Activity size={16} />}
      iconBg="bg-violet-50 text-violet-600"
      maxWidth="max-w-md"
      footer={footer}
    >
      <form id="form-agregar-medicion" onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {modo === 'catalogo' ? (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Analito
            </label>
            <AutocompleteAnalito
              analitos={analitos}
              value={analito}
              onChange={setAnalito}
              onCustomClick={() => { setModo('custom'); setAnalito(null) }}
              disabled={catalogoLoading || submitting}
            />
            {catalogoLoading && (
              <p className="mt-1 text-[11px] text-slate-400">Cargando catálogo…</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Nombre del analito
              </label>
              <input
                type="text"
                value={nombreCustom}
                onChange={e => setNombreCustom(e.target.value)}
                placeholder="Ej. Mi marcador personalizado"
                maxLength={100}
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Unidad
                </label>
                <input
                  type="text"
                  value={unidadCustom}
                  onChange={e => setUnidadCustom(e.target.value)}
                  placeholder="mg/dL, UI/mL…"
                  maxLength={30}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Categoría
                </label>
                <select
                  value={categoriaCustom}
                  onChange={e => setCategoriaCustom(e.target.value as CategoriaAnalito)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
                >
                  {CATEGORIAS_ANALITO.map(c => (
                    <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {modo === 'catalogo' && esTA ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                TA sistólica (mmHg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={valorSistolica}
                onChange={e => setValorSistolica(e.target.value)}
                placeholder="135"
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                TA diastólica (mmHg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={valorDiastolica}
                onChange={e => setValorDiastolica(e.target.value)}
                placeholder="85"
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Valor
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0"
                disabled={submitting}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
              />
              <div className="px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-500 bg-slate-50 min-w-[80px] flex items-center justify-center">
                {modo === 'catalogo' ? (analito?.unidad ?? '—') : (unidadCustom || '—')}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              max={hoyISO()}
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Hora
            </label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={submitting}
            placeholder="Contexto clínico breve…"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]/30 focus:border-[var(--cp)] disabled:bg-slate-50 resize-none"
          />
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
            {error}
          </div>
        )}
      </form>
    </ModalShell>
  )
}
