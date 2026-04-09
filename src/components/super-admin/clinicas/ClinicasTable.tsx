'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import type { ReactElement } from 'react'
import type { ClinicaResumen } from '@/lib/super-admin/types'
import { EstadoClinicaBadge, EstadoPagoBadge, TipoBadge } from './Badges'
import VipToggle from './VipToggle'

interface Props {
  items: ReadonlyArray<ClinicaResumen>
  onVipChange: (clinicaId: string, esVip: boolean) => void
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Nunca'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} d`
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} m`
  return `Hace ${Math.floor(dias / 365)} a`
}

export default function ClinicasTable({ items, onVipChange }: Props): ReactElement {
  if (items.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <Building2 size={28} className="mx-auto text-slate-700 mb-3" />
        <p className="text-[13px] text-slate-500">No hay clínicas que coincidan con los filtros.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10.5px]">
              <th className="text-left font-semibold px-4 py-3">Clínica</th>
              <th className="text-left font-semibold px-3 py-3">Tipo</th>
              <th className="text-left font-semibold px-3 py-3">Plan</th>
              <th className="text-left font-semibold px-3 py-3">VIP</th>
              <th className="text-right font-semibold px-3 py-3">Médicos</th>
              <th className="text-right font-semibold px-3 py-3">Sec.</th>
              <th className="text-right font-semibold px-3 py-3">Pacientes</th>
              <th className="text-right font-semibold px-3 py-3">Consultas</th>
              <th className="text-left font-semibold px-3 py-3">Último acceso</th>
              <th className="text-left font-semibold px-3 py-3">Estado</th>
              <th className="text-right font-semibold px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {c.logoUrl ? (
                        <Image src={c.logoUrl} alt={c.nombre} width={28} height={28} className="object-contain" />
                      ) : (
                        <Building2 size={14} className="text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-100 font-medium truncate">
                        {c.nombreDisplay ?? c.nombre}
                      </p>
                      {c.nombreDisplay && c.nombreDisplay !== c.nombre ? (
                        <p className="text-[10.5px] text-slate-500 truncate">{c.nombre}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <TipoBadge value={c.tipo} />
                </td>
                <td className="px-3 py-3">
                  <EstadoPagoBadge value={c.estadoPago} />
                </td>
                <td className="px-3 py-3">
                  <VipToggle
                    clinicaId={c.id}
                    esVip={c.esVip}
                    onChange={(v) => onVipChange(c.id, v)}
                  />
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                  {c.countMedicos}
                  <span className="text-slate-600">/{c.maxMedicos}</span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                  {c.countSecretarias}
                  <span className="text-slate-600">/{c.maxSecretarias}</span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                  {c.countPacientes.toLocaleString('es-MX')}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                  {c.countConsultas.toLocaleString('es-MX')}
                </td>
                <td className="px-3 py-3 text-slate-400">{formatRelative(c.ultimoAccesoIso)}</td>
                <td className="px-3 py-3">
                  <EstadoClinicaBadge value={c.estado} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/super-admin/dashboard/clinicas/${c.id}`}
                    className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-[#4a9fd4] transition-colors"
                  >
                    Detalle
                    <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
