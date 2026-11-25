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
        const msg =
          typeof data?.message === 'string' ? data.message :
          typeof data?.error === 'string' ? data.error :
          'Error al guardar'
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
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      {modo === 'custom' ? (
        <button
          type="button"
          onClick={() => { setModo('catalogo'); setError(null) }}
          className="k-b k-b-texto -ml-1"
          disabled={submitting}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al catálogo
        </button>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="k-b k-b-capa k-b-quieto min-w-[104px]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="form-agregar-medicion"
          disabled={submitting}
          className="k-b k-b-capa k-b-prim min-w-[104px]"
        >
          {botonLabel}
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell
      open={open}
      cierraConVelo={false}
      onClose={submitting ? () => {} : onClose}
      title="Agregar medición"
      subtitle={modo === 'custom' ? 'Analito personalizado' : 'Desde catálogo clínico'}
      icon={<Activity size={16} />}
      iconBg="bg-tonal text-tonal-tinta"
      maxWidth="max-w-md"
      footer={footer}
    >
      <form id="form-agregar-medicion" onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {modo === 'catalogo' ? (
          <div>
            <label className="k-etiqueta mb-1">
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
              <p className="k-campo-ayuda mt-1">Cargando catálogo…</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="med-nombre" className="k-etiqueta mb-1">
                Nombre del analito
              </label>
              <input
                id="med-nombre"
                type="text"
                value={nombreCustom}
                onChange={e => setNombreCustom(e.target.value)}
                placeholder="Ej. Mi marcador personalizado"
                maxLength={100}
                disabled={submitting}
                className="k-campo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-unidad" className="k-etiqueta mb-1">
                  Unidad
                </label>
                <input
                id="med-unidad"
                  type="text"
                  value={unidadCustom}
                  onChange={e => setUnidadCustom(e.target.value)}
                  placeholder="mg/dL, UI/mL…"
                  maxLength={30}
                  disabled={submitting}
                  className="k-campo"
                />
              </div>
              <div>
                <label htmlFor="med-categoria" className="k-etiqueta mb-1">
                  Categoría
                </label>
                <select
                id="med-categoria"
                  value={categoriaCustom}
                  onChange={e => setCategoriaCustom(e.target.value as CategoriaAnalito)}
                  disabled={submitting}
                  className="k-campo"
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
              <label htmlFor="med-sistolica" className="k-etiqueta mb-1">
                TA sistólica (mmHg)
              </label>
              <input
                id="med-sistolica"
                type="number"
                inputMode="decimal"
                step="any"
                value={valorSistolica}
                onChange={e => setValorSistolica(e.target.value)}
                placeholder="135"
                disabled={submitting}
                className="k-campo"
              />
            </div>
            <div>
              <label htmlFor="med-diastolica" className="k-etiqueta mb-1">
                TA diastólica (mmHg)
              </label>
              <input
                id="med-diastolica"
                type="number"
                inputMode="decimal"
                step="any"
                value={valorDiastolica}
                onChange={e => setValorDiastolica(e.target.value)}
                placeholder="85"
                disabled={submitting}
                className="k-campo"
              />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="med-valor" className="k-etiqueta mb-1">
              Valor
            </label>
            <div className="flex gap-2">
              <input
                id="med-valor"
                type="number"
                inputMode="decimal"
                step="any"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0"
                disabled={submitting}
                className="k-campo flex-1"
              />
              <div className="flex min-w-[80px] items-center justify-center rounded-[var(--r-control)] bg-sup2 px-3 text-[15px] text-tinta2">
                {modo === 'catalogo' ? (analito?.unidad ?? '—') : (unidadCustom || '—')}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="med-fecha" className="k-etiqueta mb-1">
              Fecha
            </label>
            <input
                id="med-fecha"
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              max={hoyISO()}
              disabled={submitting}
              className="k-campo"
            />
          </div>
          <div>
            <label htmlFor="med-hora" className="k-etiqueta mb-1">
              Hora
            </label>
            <input
                id="med-hora"
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              disabled={submitting}
              className="k-campo"
            />
          </div>
        </div>

        <div>
          <label htmlFor="med-notas" className="k-etiqueta mb-1">
            Notas (opcional)
          </label>
          <textarea
                id="med-notas"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={submitting}
            placeholder="Contexto clínico breve…"
            className="k-campo min-h-[88px] resize-none"
          />
        </div>

        {error && (
          <p role="alert" className="k-campo-error">{error}</p>
        )}
      </form>
    </ModalShell>
  )
}
