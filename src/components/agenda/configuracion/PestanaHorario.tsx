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
import { useState, type ReactNode } from 'react'
import { Building2, ChevronRight, Clock, MapPin, User } from 'lucide-react'
import DialogoHorario from '@/components/agenda/configuracion/DialogoHorario'
import { nombreHuso } from '@/components/agenda/configuracion/SelectorHuso'
import { guardarHorarioClinica, guardarHorarioConsultorio, type CambiosConsultorio } from '@/components/agenda/configuracion/accionesConfig'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import {
  AVISO_EN_LISTA, AVISO_SOLO_ADMIN, AYUDA, BLOQUE, FILA, FILA_ACCION, LISTA, PANEL, PIE, ROTULO, SOLO_ADMIN, SOLO_ADMIN_HORARIO, SUB_PANEL, TITULO_PANEL,
} from '@/components/agenda/configuracion/estilosConfig'
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

const ENLACE = 'font-semibold text-enlace underline underline-offset-2'
const CHEV = <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className="ml-auto flex-none text-tinta3" />

/**
 * Una línea del horario como fila de dos columnas (B13 · AG9, maqueta `ag-config`): días en `--tinta`, horas
 * tabulares en `--tinta2`. El « · » de `lineasHorario` se queda en el texto para quien lee la fila de corrido
 * (lector de pantalla, `toContainText` de las pruebas), pero no se ve: lo dice la columna.
 */
function LineaHorario({ linea }: { linea: string }) {
  const i = linea.indexOf(' · ')
  const dias = i < 0 ? linea : linea.slice(0, i)
  const horas = i < 0 ? '' : linea.slice(i + 3)
  return (
    <div className={FILA}>
      <span className="text-[15px] leading-[20px] text-tinta">{dias}<span className="sr-only"> · </span></span>
      <span className="text-right text-[15px] leading-[20px] tabular-nums text-tinta2">{horas}</span>
    </div>
  )
}

/** Las líneas del horario, o «Sin días de consulta». */
function Lineas({ horario }: { horario: Horario }) {
  const lineas = lineasHorario(horario)
  if (!lineas.length) return <p className={`${FILA} m-0 text-[15px] italic text-tinta3`}>Sin días de consulta</p>
  return <>{lineas.map(l => <LineaHorario key={l} linea={l} />)}</>
}

/** El rótulo de un grupo (icono fuera de la superficie) con sus etiquetas a la derecha. */
function Rotulo({ icono, titulo, etiquetas }: { icono: ReactNode; titulo: string; etiquetas?: ReactNode }) {
  return (
    <div className="flex min-h-[24px] items-center justify-between gap-[8px]">
      <h3 className={`${ROTULO} pr-0`}>{icono}<span className="truncate">{titulo}</span></h3>
      {etiquetas && <span className="flex flex-none gap-[6px] pr-[16px] ih:pr-[20px] iv:pr-[20px] esc:pr-[20px]">{etiquetas}</span>}
    </div>
  )
}

function Etiquetas({ c }: { c: Consultorio }) {
  const propio = c.horario_propio === true
  return (
    <>
      {c.horario_revisado_en === null && <span className="k-etq k-etq-aviso"><Clock aria-hidden="true" />Por revisar</span>}
      <span className={`k-etq ${propio ? 'k-etq-tonal' : ''}`}>{propio ? 'Horario propio' : 'Igual que la clínica'}</span>
    </>
  )
}

function Tarjeta({ c, p, alAbrir, alConfirmar }: { c: Consultorio; p: Props; alAbrir: () => void; alConfirmar: () => void }) {
  const esDueno = c.medico_id === p.usuarioId
  const medico = esDueno ? null : p.medicos.find(m => m.id === c.medico_id)
  return (
    <section role="group" aria-label={c.nombre} className={BLOQUE}>
      <Rotulo icono={<MapPin size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />} titulo={c.nombre} etiquetas={<Etiquetas c={c} />} />
      <div className={LISTA}>
        {medico && (
          <p className={`${FILA} m-0 justify-start gap-[8px] text-[13px] leading-[18px] text-tinta2`}>
            <User size={16} aria-hidden="true" className="flex-none text-tinta3" />{componerNombreMedicoCompleto(medico)}
          </p>
        )}
        <Lineas horario={horarioEfectivo(c, p.horarioClinica)} />
        {esDueno && c.horario_revisado_en === null && (
          <button type="button" className={FILA_ACCION} onClick={alConfirmar}><span className="flex-1">Confirmar horario</span></button>
        )}
        {esDueno && (
          <button type="button" className={FILA_ACCION} onClick={alAbrir} aria-label={`Cambiar horario de ${c.nombre}`}>
            <span className="flex-1">Cambiar horario</span>{CHEV}
          </button>
        )}
      </div>
    </section>
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
 * K3 (punto 11 de Angel): el horario de la clínica, al INICIO de la pestaña y antes de los consultorios, con sus
 * días y horas a la vista. «Cambiar horario» sólo para quien administra (`canManageClinica`, el mismo criterio que
 * `PUT /api/me/horario`); los demás lo ven sin botón.
 */
function TarjetaClinica({ p, alAbrir }: { p: Props; alAbrir: () => void }) {
  return (
    <section role="group" aria-label="Horario de la clínica" data-horario-clinica className={BLOQUE}>
      <Rotulo icono={<Building2 size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />} titulo="Horario de la clínica" />
      <div className={LISTA}>
        {p.horarioClinica ? <Lineas horario={p.horarioClinica} />
          : <p className={`${FILA} m-0 text-[14px] text-tinta2`}>{p.fallo ? 'No se pudo cargar. Recarga la página.' : '…'}</p>}
        {p.husoClinica && (
          <div className={`${FILA} flex-col items-start gap-[2px] ih:flex-row ih:items-center iv:flex-row iv:items-center esc:flex-row esc:items-center`}>
            <span className="text-[13px] leading-[18px] text-tinta2 ih:text-[15px] iv:text-[15px] esc:text-[15px] ih:text-tinta iv:text-tinta esc:text-tinta">Huso horario<span className="sr-only">: </span></span>
            <span className="text-[15px] leading-[20px] text-tinta ih:text-right iv:text-right esc:text-right">{nombreHuso(p.husoClinica)}</span>
          </div>
        )}
        {/* Tanda M (punto 15): en la tarjeta, sólo el médico invitado (sus consultorios sí los cambia); la secretaria lo lee al inicio. */}
        {p.esMedico && !p.puedeAdministrar && <span data-solo-admin className={`${AVISO_SOLO_ADMIN} ${AVISO_EN_LISTA} block`}>{SOLO_ADMIN}</span>}
        {p.puedeAdministrar && p.horarioClinica && (
          <button type="button" onClick={alAbrir} className={FILA_ACCION} aria-label="Cambiar horario de la clínica">
            <span className="flex-1">Cambiar horario</span>{CHEV}
          </button>
        )}
      </div>
      <p className={PIE}>Lo usan los consultorios que dicen «Igual que la clínica».</p>
    </section>
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
      {/* Tanda M (punto 15): la secretaria no cambia nada de esta pestaña (`PUT /api/me/horario` 403; consultorios, 404). */}
      {!p.esMedico && <p data-solo-admin className={AVISO_SOLO_ADMIN}>{SOLO_ADMIN_HORARIO}</p>}
      <TarjetaClinica p={p} alAbrir={() => setAbierto({ tipo: 'clinica' })} />
      {!p.consultorios || !clinica ? <p className={`m-0 ${AYUDA}`}>{p.fallo ? 'No se pudieron cargar los consultorios. Recarga la página.' : 'Cargando los consultorios…'}</p>
        : p.consultorios.length === 0 ? <p className={`m-0 ${AYUDA}`}>Aún no hay consultorios activos.</p>
        : p.consultorios.map(c => (
          <Tarjeta key={c.id} c={c} p={p} alAbrir={() => setAbierto({ tipo: 'consultorio', c })} alConfirmar={() => void guardar(c, { horario_revisado: true })} />
        ))}
      {p.esMedico && (
        <p className={`m-0 ${AYUDA}`}>Agrega más consultorios en tu <Link href="/perfil" className={ENLACE}>perfil</Link>.</p>
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
