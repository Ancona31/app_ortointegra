'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'

/**
 * Selector de "consultorio activo" de la navegación.
 *
 * Se puede CAMBIAR sólo si:
 * - profile.role === 'medico' (vía useProfile().isDoctor); secretarias no
 *   tienen consultorios propios — al agendar citas eligen el consultorio
 *   del médico desde el modal de agenda (Bloque F3-6).
 * - consultorios.length >= 2.
 *
 * El cambio del activo abre un modal de confirmación (ModalShell) antes
 * de invocar cambiarActivo() del Context.
 *
 * ⚠️ DOS PRESENTACIONES (B4 del rediseño, CALMA §28):
 * - `barra`: la tarjeta de identidad de la barra lateral y del cajón, con el
 *   LOGO DE LA CLÍNICA (vuelve aquí desde la cabecera vieja). Si no se puede
 *   cambiar, la tarjeta se queda como identidad quieta: «Consultorio · Centro»
 *   con un consultorio, «Clínica · <nombre>» para la secretaria.
 * - `fila`: la fila «Consultorio activo · Centro ›» del menú «Más» (`ext`,
 *   `iv`), que despliega la lista dentro del propio menú. Sólo existe si se
 *   puede cambiar.
 * La lista, «Gestionar consultorios →», la confirmación y el aviso son los de
 * siempre, con sus textos.
 */

interface Props {
  variante: 'barra' | 'fila'
  /** `clinicas.logo_url`; sin uno válido se pinta el logo de Spinus. */
  logoUrl: string | null
  /** Para la identidad quieta (secretaria o médico sin consultorio activo). */
  nombreClinica: string
}

const getDisplayName = (c: Consultorio) => c.nombre_corto || c.nombre

/** El logo de la clínica en su círculo blanco. 72 = 2× los 36 px del círculo. */
function LogoClinica({ logoUrl, nombreClinica }: { logoUrl: string | null; nombreClinica: string }) {
  const alt = nombreClinica ? `Logo de ${nombreClinica}` : 'Logo'
  return (
    <span className="nav-consultorio-logo">
      {logoUrl?.startsWith('https://')
        ? <Image src={logoUrl} alt={alt} width={72} height={72} className="h-full w-full object-contain" />
        : <Image src="/logo.png" alt={alt} width={72} height={72} className="h-full w-full object-contain"
            onError={e => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}

interface Lista {
  consultorios: Consultorio[]
  activoId: string
  alElegir: (c: Consultorio) => void
  alGestionar: () => void
  variante: Props['variante']
}

function ListaConsultorios({ consultorios, activoId, alElegir, alGestionar, variante }: Lista) {
  return (
    <div className={variante === 'barra' ? 'nav-consultorio-lista' : 'nav-consultorio-lista-fila'}>
      {consultorios.map(c => (
        <button key={c.id} type="button" onClick={() => alElegir(c)} className="nav-consultorio-opcion">
          <span className="truncate">{getDisplayName(c)}</span>
          {c.id === activoId && <Check size={16} className="flex-none text-accion" aria-hidden="true" />}
        </button>
      ))}
      {/* Cierra los DOS: su propio desplegable y el menú lateral. En móvil la
          barra tapa la pantalla completa, así que sin `cerrar()` este enlace
          navegaba a /perfil y dejaba el menú encima de la página a la que
          acababa de llevar. Mismo gesto que el `onClick={close}` de cada
          enlace de `Sidebar.tsx`. */}
      <Link href="/perfil" onClick={alGestionar} className="nav-consultorio-gestionar">
        Gestionar consultorios →
      </Link>
    </div>
  )
}

/** Click fuera y Escape cierran el desplegable, salvo con la confirmación encima (vive en un portal). */
function useCierreDesplegable(open: boolean, bloqueado: boolean, cerrar: () => void, contenedor: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open || bloqueado) return
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) cerrar()
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [open, bloqueado, cerrar, contenedor])
}

interface Disparador { nombre: string; open: boolean; alternar: () => void }

function IdentidadQuieta({ logoUrl, nombreClinica, consultorio }: { logoUrl: string | null; nombreClinica: string; consultorio: Consultorio | null }) {
  return (
    <div className="nav-consultorio-boton">
      <LogoClinica logoUrl={logoUrl} nombreClinica={nombreClinica} />
      <span className="nav-consultorio-texto">
        <span className="nav-consultorio-rotulo">{consultorio ? 'Consultorio' : 'Clínica'}</span>
        <span className="nav-consultorio-nombre">{consultorio ? getDisplayName(consultorio) : nombreClinica}</span>
      </span>
    </div>
  )
}

function BotonBarra({ logoUrl, nombreClinica, d }: { logoUrl: string | null; nombreClinica: string; d: Disparador }) {
  return (
    <button type="button" onClick={d.alternar} aria-expanded={d.open} aria-label={`Consultorio activo: ${d.nombre}`}
      className="nav-consultorio-boton k-pulsable">
      <LogoClinica logoUrl={logoUrl} nombreClinica={nombreClinica} />
      <span className="nav-consultorio-texto">
        <span className="nav-consultorio-rotulo">Consultorio</span>
        <span className="nav-consultorio-nombre">{d.nombre}</span>
      </span>
      <ChevronsUpDown size={16} className="flex-none opacity-70" aria-hidden="true" />
    </button>
  )
}

function BotonFila({ d }: { d: Disparador }) {
  return (
    <button type="button" onClick={d.alternar} aria-expanded={d.open} aria-label={`Consultorio activo: ${d.nombre}`}
      className="nav-fila">
      <ChevronsUpDown size={20} className="nav-fila-icono" aria-hidden="true" />
      <span className="flex-1">Consultorio activo</span>
      <span className="nav-fila-valor">{d.nombre}</span>
      <ChevronRight size={18} className={`nav-fila-flecha ${d.open ? 'rotate-90' : ''}`} aria-hidden="true" />
    </button>
  )
}

export default function ConsultorioActivoSelector({ variante, logoUrl, nombreClinica }: Props) {
  const { isDoctor } = useProfile()
  const { consultorios } = useConsultorios()
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()
  const { cerrar: cerrarMenu } = useMenuMovil()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [pendingChange, setPendingChange] = useState<Consultorio | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useCierreDesplegable(open, !!pendingChange, () => setOpen(false), containerRef)

  const cambiable = isDoctor && consultorios.length >= 2 && !!consultorioActivo
  if (!cambiable || !consultorioActivo) {
    if (variante === 'fila') return null
    return <IdentidadQuieta logoUrl={logoUrl} nombreClinica={nombreClinica} consultorio={isDoctor ? consultorioActivo : null} />
  }

  const handleClick = (c: Consultorio) => {
    if (c.id === consultorioActivo.id) { setOpen(false); return }
    setPendingChange(c)
  }

  const handleConfirm = () => {
    if (!pendingChange) return
    cambiarActivo(pendingChange)
    toast.info(`Consultorio activo: ${getDisplayName(pendingChange)}`)
    setPendingChange(null)
    setOpen(false)
  }

  const d: Disparador = { nombre: getDisplayName(consultorioActivo), open, alternar: () => setOpen(!open) }
  return (
    <>
      <div ref={containerRef} className="relative">
        {variante === 'barra' ? <BotonBarra logoUrl={logoUrl} nombreClinica={nombreClinica} d={d} /> : <BotonFila d={d} />}
        {open && (
          <ListaConsultorios consultorios={consultorios} activoId={consultorioActivo.id} alElegir={handleClick}
            alGestionar={() => { setOpen(false); cerrarMenu() }} variante={variante} />
        )}
      </div>
      <ModalShell
        open={!!pendingChange}
        onClose={() => setPendingChange(null)}
        title="Cambiar consultorio activo"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2 px-5 py-3.5">
            <button type="button" onClick={() => setPendingChange(null)} className="k-b-tonal">Cancelar</button>
            <button type="button" onClick={handleConfirm} className="k-b-prim">Sí, cambiar</button>
          </div>
        }
      >
        <div className="px-5 py-5">
          <p className="text-[15px] text-tinta">
            ¿Cambiar a <strong>{pendingChange ? getDisplayName(pendingChange) : ''}</strong>?
          </p>
        </div>
      </ModalShell>
    </>
  )
}
