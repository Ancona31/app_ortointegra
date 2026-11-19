'use client'

/**
 * Pestaña «Cuándo das consulta» (tanda J, J5, puntos 14, 15 y 16; maqueta
 * `Configuracion.dc.html`). Una tarjeta por consultorio con su insignia
 * («Horario propio» / «Igual que la clínica») y sus líneas; «Cambiar horario»
 * abre `DialogoHorario` y guarda con `PATCH /api/consultorios/[id]` (sólo su
 * dueño: la RLS). Nunca manda `timezone`: el huso de cada consultorio sigue
 * siendo el suyo (punto 17).
 *
 * Arriba, antes de los consultorios, el horario de la clínica en su tarjeta (K3, punto 11) y, SÓLO
 * para quien administra, su «Cambiar horario»: el mismo control de días, guardado con `PUT /api/me/horario`,
 * que ya valida el rol en el servidor (`canManageClinica`), el horario
 * (`HorarioEnOrdenSchema`), filtra por `clinica_id` y lo apunta en `audit_log`.
 * Y, para los médicos, «Agrega más consultorios en tu perfil» (punto 16).
 *
 * Lo que la maqueta no tiene y se conserva (I4): «Por revisar» y «Confirmar
 * horario» en el consultorio cuyo horario nadie ha confirmado.
 */
import Link from 'next/link'
import { useState } from 'react'
import DialogoHorario from '@/components/agenda/configuracion/DialogoHorario'
import { nombreHuso } from '@/components/agenda/configuracion/SelectorHuso'
import { guardarHorarioClinica, guardarHorarioConsultorio, type CambiosConsultorio } from '@/components/agenda/configuracion/accionesConfig'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import { AYUDA, BOTON_CHICO, PANEL, SUB_PANEL, TITULO_PANEL } from '@/components/agenda/configuracion/estilosConfig'
import { lineasHorario, textoHorario } from '@/lib/agenda/gruposHorario'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import type { ModoHorario } from '@/lib/agenda/primeraVez'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { ConfigApp, Horario, MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'

interface Props {
  consultorios: readonly Consultorio[] | null
  fallo: boolean
  horarioClinica: Horario | null
  /** `clinicas.timezone` (K3, punto 12), o `null` si la clínica aún no eligió. */
  husoClinica: string | null
  medicos: readonly MedicoConfig[]
  usuarioId: string
  esMedico: boolean
  puedeAdministrar: boolean
  actualizarConfig: (cambio: (c: ConfigApp) => ConfigApp) => void
  avisar: Avisar
  alCambiar: () => void
}

const INSIGNIA = 'rounded-full px-[10px] py-[3px] text-[13px] font-semibold'
const ENLACE = 'font-semibold text-[var(--ag-brand-legible)] underline underline-offset-2'

function Tarjeta({ c, p, alAbrir, alConfirmar }: { c: Consultorio; p: Props; alAbrir: () => void; alConfirmar: () => void }) {
  const clinica = p.horarioClinica
  const efectivo = horarioEfectivo(c, clinica)
  const propio = c.horario_propio === true
  const esDueno = c.medico_id === p.usuarioId
  const medico = esDueno ? null : p.medicos.find(m => m.id === c.medico_id)
  const lineas = lineasHorario(efectivo)
  return (
    <div role="group" aria-label={c.nombre} className="flex flex-wrap items-start justify-between gap-[16px] rounded-[12px] border border-[var(--ag-border-card)] px-[20px] py-[18px]">
      <div className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[15px] font-semibold text-[var(--ag-ink)]">{c.nombre}</span>
          <span className={`${INSIGNIA} ${propio ? 'bg-[var(--ag-primary-bg-faint)] text-[var(--ag-brand-legible)]' : 'bg-[var(--ag-segment-bg)] text-[var(--ag-ink-600)]'}`}>
            {propio ? 'Horario propio' : 'Igual que la clínica'}
          </span>
          {c.horario_revisado_en === null && <span className={`${INSIGNIA} bg-[var(--ag-aviso-bg)] text-[var(--ag-aviso-text)]`}>Por revisar</span>}
        </div>
        {medico && <span className="text-[13.5px] text-[var(--ag-ink-600)]">{componerNombreMedicoCompleto(medico)}</span>}
        {lineas.length ? lineas.map(l => <span key={l} className="text-[14px] text-[var(--ag-text)]">{l}</span>)
          : <span className="text-[14px] italic text-[var(--ag-muted)]">Sin días de consulta</span>}
      </div>
      {esDueno && (
        <div className="flex flex-wrap gap-[8px]">
          {c.horario_revisado_en === null && <button type="button" className={BOTON_CHICO} onClick={alConfirmar}>Confirmar horario</button>}
          <button type="button" className={BOTON_CHICO} onClick={alAbrir} aria-label={`Cambiar horario de ${c.nombre}`}>Cambiar horario</button>
        </div>
      )}
    </div>
  )
}

/** Guarda un consultorio y escribe su rebanada del agregado (la agenda la verá sin releer). */
function useGuardarConsultorio(p: Props) {
  return async (c: Consultorio, cambios: CambiosConsultorio): Promise<string | null> => {
    const r = await guardarHorarioConsultorio(c.id, cambios)
    p.avisar(r.ok ? { ok: true } : r)
    if (!r.ok) return r.motivo
    const columnas = 'horario_revisado' in cambios ? {} : cambios
    p.actualizarConfig(cfg => ({ ...cfg, consultorios: cfg.consultorios.map(x => (x.id === c.id
      ? { ...x, ...columnas, ...(r.valor !== undefined ? { horario_revisado_en: r.valor } : {}) } : x)) }))
    p.alCambiar()
    return null
  }
}

/**
 * K3 (punto 11 de Angel): el horario de la clínica en su tarjeta, al INICIO de la pestaña y antes de
 * los consultorios, con sus días y horas a la vista. «Cambiar horario» sólo para quien administra
 * (`canManageClinica`, el mismo criterio que `PUT /api/me/horario`); los demás lo ven sin botón.
 */
function TarjetaClinica({ p, alAbrir }: { p: Props; alAbrir: () => void }) {
  const lineas = p.horarioClinica ? lineasHorario(p.horarioClinica) : null
  return (
    <div role="group" aria-label="Horario de la clínica" data-horario-clinica
      className="flex flex-wrap items-start justify-between gap-[16px] rounded-[12px] border border-[var(--ag-border-card)] px-[20px] py-[18px]">
      <div className="flex flex-col gap-[6px]">
        <span className="text-[15px] font-semibold text-[var(--ag-ink)]">Horario de la clínica</span>
        {!lineas ? <span className="text-[14px] text-[var(--ag-ink-600)]">{p.fallo ? 'No se pudo cargar. Recarga la página.' : '…'}</span>
          : lineas.length ? lineas.map(l => <span key={l} className="text-[14px] text-[var(--ag-text)]">{l}</span>)
          : <span className="text-[14px] italic text-[var(--ag-muted)]">Sin días de consulta</span>}
        {p.husoClinica && <span className="text-[14px] text-[var(--ag-text)]">Huso horario: {nombreHuso(p.husoClinica)}</span>}
        <span className="text-[13.5px] leading-[1.5] text-[var(--ag-ink-600)]">
          Lo usan los consultorios que dicen «Igual que la clínica».{p.puedeAdministrar ? '' : ' Lo cambia quien administra la clínica.'}
        </span>
      </div>
      {p.puedeAdministrar && p.horarioClinica && (
        <button type="button" onClick={alAbrir} className={BOTON_CHICO} aria-label="Cambiar horario de la clínica">Cambiar horario</button>
      )}
    </div>
  )
}

type Abierto = { tipo: 'consultorio'; c: Consultorio } | { tipo: 'clinica' } | null

export default function PestanaHorario(p: Props) {
  const [abierto, setAbierto] = useState<Abierto>(null)
  const guardar = useGuardarConsultorio(p)
  const clinica = p.horarioClinica
  async function guardarDialogo(modo: ModoHorario, h: Horario, huso?: string): Promise<string | null> {
    if (abierto?.tipo === 'clinica') {
      /* El huso sólo viaja si cambió: sin la migración de K3 el PUT con huso da 409 y el horario solo sigue guardándose. */
      const r = await guardarHorarioClinica(h, huso && huso !== p.husoClinica ? huso : undefined)
      p.avisar(r.ok ? { ok: true } : r)
      if (!r.ok) return r.motivo
      p.actualizarConfig(cfg => ({ ...cfg, horario: h }))
      p.alCambiar()
    } else if (abierto?.tipo === 'consultorio') {
      /* «Igual que la clínica» copia además el de la clínica en la columna: no cambia lo que vale
         (hereda), pero uno que nació cerrado deja de contar como «sin tocar» (`cambiosPaso1`). */
      const motivo = await guardar(abierto.c, { horario_propio: modo === 'propio', horario: modo === 'propio' ? h : clinica ?? h })
      if (motivo) return motivo
    }
    setAbierto(null)
    return null
  }
  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-[6px]">
        <h2 className={TITULO_PANEL}>Cuándo das consulta</h2>
        <p className={SUB_PANEL}>Tus pacientes solo pueden pedir cita en estos días y horas.</p>
      </div>
      <TarjetaClinica p={p} alAbrir={() => setAbierto({ tipo: 'clinica' })} />
      {!p.consultorios || !clinica ? <p className={AYUDA}>{p.fallo ? 'No se pudieron cargar los consultorios. Recarga la página.' : 'Cargando los consultorios…'}</p>
        : p.consultorios.length === 0 ? <p className={AYUDA}>Aún no hay consultorios activos.</p>
        : p.consultorios.map(c => (
          <Tarjeta key={c.id} c={c} p={p} alAbrir={() => setAbierto({ tipo: 'consultorio', c })} alConfirmar={() => void guardar(c, { horario_revisado: true })} />
        ))}
      {p.esMedico && (
        <p className="m-0 text-[13.5px] text-[var(--ag-ink-600)]">Agrega más consultorios en tu <Link href="/perfil" className={ENLACE}>perfil</Link>.</p>
      )}
      {abierto && clinica && (
        <DialogoHorario
          titulo={abierto.tipo === 'clinica' ? 'Horario de la clínica' : `Horario en ${abierto.c.nombre}`}
          modos={abierto.tipo === 'clinica' ? null : { inicial: abierto.c.horario_propio === true ? 'propio' : 'clinica', textoClinica: textoHorario(clinica) }}
          horario={abierto.tipo === 'clinica' ? clinica : horarioEfectivo(abierto.c, clinica)}
          huso={abierto.tipo === 'clinica' ? p.husoClinica ?? p.consultorios?.[0]?.timezone ?? 'America/Mexico_City' : undefined}
          nota={abierto.tipo === 'clinica'
            ? 'Cambia el horario de todos los consultorios que dicen «Igual que la clínica». El huso de cada consultorio no cambia. Las citas que ya están apartadas no se mueven.'
            : 'Las citas que ya tienes apartadas no se mueven.'}
          alGuardar={guardarDialogo} alCerrar={() => setAbierto(null)} />
      )}
    </div>
  )
}
