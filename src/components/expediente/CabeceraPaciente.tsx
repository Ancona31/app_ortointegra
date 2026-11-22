'use client'

import { useRef, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ChevronLeft, FileDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Paciente } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import { formatearTelefono } from '@/lib/validaciones'
import { leerFormato } from '@/lib/formatoPantalla'
import Avatar, { inicialesDe } from '@/components/ui/Avatar'
import CapaMenu, { type OpcionMenu } from '@/components/ui/CapaMenu'
import ExportarExpedienteButton, { type ControlExportar } from './ExportarExpedienteButton'

/* ═══ CABECERA DEL PACIENTE (rediseño B7, maqueta `final-expediente`) ═══════════
   UN SOLO MARCADO para los cinco formatos; lo que cambia lo decide el CSS
   (variantes `ext: tel: ih: iv: esc:`), nunca el formato leído en el render.

     ext / tel / ih / iv   «‹ Expediente», avatar, nombre, «edad · sexo · Exp.»,
                           la etiqueta de alergias y debajo «Nueva consulta»
                           (primario) + «Nuevo documento» (texto). El «···»
                           va arriba a la derecha en ext/tel y al final de las
                           acciones en ih/iv.
     esc                   la columna izquierda de la página (la ficha):
                           identidad, los pares Expediente/Teléfono/Nacimiento,
                           «Nueva consulta» a lo ancho y «Nuevo documento ·
                           Editar · ···» debajo.

   ⚠️ LA ALERGIA ES UNA ETIQUETA PEGADA A LA IDENTIDAD (CALMA §3), visible en
   las cuatro pestañas. Antes era la banda roja del Resumen: se mudó aquí, no
   se quitó.
   ⚠️ «EDITAR», «EXPORTAR» Y «ELIMINAR PACIENTE» VIVEN EN EL «···» («Acciones
   del paciente», CALMA §30.5); en esc «Editar» además se ve. La exportación
   pinta su estado bajo las acciones (`ExportarExpedienteButton`). */

const SEXO_LABEL: Record<Paciente['sexo'], string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

/** «11 feb 1953»; si la fecha no se entiende, tal cual llegó. */
function fechaNacimientoLegible(iso: string): string {
  try {
    const d = parseISO(iso)
    return Number.isNaN(d.getTime()) ? iso : format(d, 'd MMM yyyy', { locale: es })
  } catch {
    return iso
  }
}

/** «999 000 0001» con diez dígitos; cualquier otra forma, sin tocar. */
function telefonoLegible(tel: string): string {
  return /^\d{10}$/.test(tel.replace(/\s/g, '')) ? formatearTelefono(tel) : tel
}

/**
 * Expediente, Teléfono y Nacimiento (CALMA §30.4). En `esc` van en la ficha de
 * la columna izquierda; en el resto, en el plegable «Datos del paciente» del
 * Resumen (`FichaClinica`). Sin dato, el par no se dibuja.
 */
export function paresDatosPaciente(paciente: Paciente): { r: string; v: string }[] {
  const pares: { r: string; v: string | null }[] = [
    { r: 'Expediente', v: paciente.numero_expediente ?? null },
    { r: 'Teléfono', v: paciente.telefono ? telefonoLegible(paciente.telefono) : null },
    { r: 'Nacimiento', v: paciente.fecha_nacimiento ? fechaNacimientoLegible(paciente.fecha_nacimiento) : null },
  ]
  return pares.flatMap(p => (p.v ? [{ r: p.r, v: p.v }] : []))
}

/** Los pares de la ficha de computadora. */
function ParesFicha({ paciente }: { paciente: Paciente }) {
  const pares = paresDatosPaciente(paciente)
  if (pares.length === 0) return null
  return (
    <dl className="k-lista hidden border-y border-linea esc:block">
      {pares.map(p => (
        <div key={p.r} className="flex min-h-[40px] items-center justify-between gap-3 py-2">
          <dt className="text-[14px] text-tinta2">{p.r}</dt>
          <dd className="k-num min-w-0 text-right text-[14px] text-tinta [overflow-wrap:anywhere]">{p.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function BotonMas({ abierto, onAbrir, className }: {
  abierto: boolean
  onAbrir: (e: MouseEvent<HTMLButtonElement>) => void
  className: string
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Acciones del paciente"
      aria-haspopup="menu"
      aria-expanded={abierto}
      className={`k-b k-b-icono ${className}`}
    >
      <MoreHorizontal aria-hidden="true" />
    </button>
  )
}

export default function CabeceraPaciente({ paciente, isDoctor, onEditar, onNuevoDocumento, onEliminar }: {
  paciente: Paciente
  isDoctor: boolean
  onEditar: () => void
  onNuevoDocumento: () => void
  onEliminar: () => void
}) {
  const [menu, setMenu] = useState(false)
  const ancla = useRef<HTMLElement | null>(null)
  const exportador = useRef<ControlExportar>(null)

  const edad = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento).anios : null
  const nombreCompleto = `${paciente.nombre} ${paciente.apellidos}`.trim()
  const alergias = paciente.alergias?.trim()
  const datos = [edad !== null ? `${edad} años` : null, SEXO_LABEL[paciente.sexo]].filter(Boolean).join(' · ')

  /* Hay dos «···» (uno por posición); el ancla es el que se pulsó. */
  const abrirMenu = (e: MouseEvent<HTMLButtonElement>) => {
    ancla.current = e.currentTarget
    setMenu(m => !m)
  }

  /* «Editar» ya se ve en computadora; en el resto sólo está en el menú. Se lee
     el formato AL ABRIR (tras montar), nunca en el primer render. */
  const opciones: OpcionMenu[] = [
    ...(leerFormato() === 'esc' ? [] : [{ id: 'editar', texto: 'Editar', icono: <Pencil aria-hidden="true" />, alElegir: onEditar }]),
    { id: 'exportar', texto: 'Exportar', icono: <FileDown aria-hidden="true" />, alElegir: () => exportador.current?.exportar() },
    { id: 'eliminar', texto: 'Eliminar paciente', icono: <Trash2 aria-hidden="true" />, peligro: true, alElegir: onEliminar },
  ]

  return (
    <header className="flex flex-col gap-3 esc:gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/expediente" prefetch={false} className="k-b k-b-texto -ml-1 h-[var(--k-toque)] text-[13px]">
          <ChevronLeft size={16} aria-hidden="true" /> Expediente
        </Link>
        {isDoctor && <BotonMas abierto={menu} onAbrir={abrirMenu} className="-mr-2 ih:hidden iv:hidden esc:hidden" />}
      </div>

      {/* Identidad. En esc el avatar va encima del nombre (columna). */}
      <div className="flex items-start gap-3 esc:flex-col">
        <Avatar texto={inicialesDe(paciente.nombre, paciente.apellidos)} tam={44} className="mt-0.5 esc:mt-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold leading-7 tracking-[-0.3px] text-tinta [overflow-wrap:anywhere] iv:text-[26px] iv:leading-8">
            {nombreCompleto}
          </h1>
          <p className="k-t-sec mt-0.5 k-num">
            {datos}
            {paciente.numero_expediente && <span className="esc:hidden">{datos ? ' · ' : ''}<span className="whitespace-nowrap">{paciente.numero_expediente}</span></span>}
          </p>
          {alergias && (
            <span className="k-etq k-etq-mal mt-2 h-auto min-h-6 max-w-full whitespace-normal py-0.5">
              <AlertTriangle aria-hidden="true" />
              Alergias: {alergias}
            </span>
          )}
        </div>
      </div>

      <ParesFicha paciente={paciente} />

      {isDoctor && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 esc:flex-col esc:items-stretch">
            <Link href={`/expediente/${paciente.id}/nueva-nota`} prefetch={false} className="k-b k-b-prim">
              Nueva consulta
            </Link>
            <div className="flex min-w-0 items-center gap-2 esc:justify-between">
              <button type="button" onClick={onNuevoDocumento} className="k-b k-b-texto">Nuevo documento</button>
              <button type="button" onClick={onEditar} className="k-b k-b-texto hidden esc:inline-flex">Editar</button>
              <BotonMas abierto={menu} onAbrir={abrirMenu} className="hidden ih:inline-flex iv:inline-flex esc:inline-flex" />
            </div>
          </div>
          <ExportarExpedienteButton paciente={paciente} ref={exportador} />
        </div>
      )}

      <CapaMenu abierto={menu} alCerrar={() => setMenu(false)} ancla={ancla} titulo="Acciones del paciente" opciones={opciones} />
    </header>
  )
}
