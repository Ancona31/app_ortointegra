'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { Folder, FolderOpen, Link2, Plus, Stethoscope, FilePlus2, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
/* El «+ Nueva consulta» de la cabecera. Vive en `components/launcher/` porque
   nació en `(launcher)/inicio`; aquí sólo se importa —esa página no se toca—.
   Es la ÚNICA pieza de la app que hace lo que pide la adenda §1: elegir
   paciente (o crearlo) y entrar a la nota SIN exigir cita previa. */
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import ProximasCitas, { type Cita, type Donde } from '@/components/dashboard/ProximasCitas'
import { nombreDeCita } from '@/components/dashboard/PiezasCita'
import TarjetaHoy from '@/components/dashboard/TarjetaHoy'
import AtendidosRecientemente from '@/components/dashboard/AtendidosRecientemente'
import DocumentosRecientes from '@/components/dashboard/DocumentosRecientes'
import BuscadorPaciente from '@/components/dashboard/BuscadorPaciente'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import { esPorAsignar, esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import Identidad from './Identidad'

/* Tanda J (punto 6) · La ventana de «Ligar e iniciar consulta», en su propio
   chunk: sólo se descarga al pulsar el botón de una fila por ligar. */
const VentanaLigarCita = dynamic(() => import('@/components/agenda/VentanaLigarCita'), { ssr: false })

/* ─── Retícula (rediseño B5, maqueta `dashboard-final`) ──────────────────
   Una columna en ext/tel/ih con el orden de la maqueta (`order-*`); dos en iv
   («Después» junto a «Atendidos») y dos en esc (citas a la izquierda, acciones
   y el resto a la derecha). La pieza principal y «Después» los pinta
   `ProximasCitas` dentro de un `display: contents`, así que son hijos de esta
   retícula como los demás. */
const RETICULA = 'grid grid-cols-1 items-start gap-4 iv:grid-cols-2 esc:grid-cols-[minmax(0,1fr)_minmax(300px,384px)] esc:gap-5'
const HUECO = {
  hero: 'order-1 iv:col-span-2 esc:col-start-1 esc:row-start-1',
  acciones: 'order-2 iv:col-span-2 esc:col-start-2 esc:row-start-1',
  lista: 'order-3 esc:col-start-1 esc:row-start-2 esc:row-span-2',
  atendidos: 'order-4 esc:col-start-2 esc:row-start-2',
  documentos: 'order-5 iv:col-span-2 esc:col-start-2 esc:row-start-3',
} as const

/* Los botones de la cabecera de acciones: tonal el de «Nueva consulta» (el
   primario de la pantalla es «Iniciar consulta») y `--sup` los demás. */
const BOTON_ACCION = 'k-b h-11 min-w-0 px-3 ih:h-10 esc:h-10'
const BOTON_SUP = `${BOTON_ACCION} bg-sup text-tonal-tinta`

/** «Iniciar consulta» y el expediente de una cita con paciente, en la pieza principal o en la hoja. */
function AccionesCita({ cita, enCurso, donde, alIniciar }: {
  cita: Cita; enCurso: boolean; donde: Donde; alIniciar: () => void
}): ReactElement {
  /* La precarga sólo la lleva la cita en curso (`fcb2169`). */
  const precarga = enCurso ? undefined : false
  const iniciar = (
    <Link href={`/expediente/${cita.paciente_id}/nueva-nota?cita=${cita.id}`} onClick={alIniciar} prefetch={precarga}
      className={`k-b k-b-prim ${donde === 'hoja' ? 'k-b-capa w-full' : 'h-11 flex-1 ih:h-10 ih:flex-none iv:flex-none esc:h-10 esc:flex-none'}`}>
      <Stethoscope aria-hidden="true" className="size-[18px]" /> Iniciar consulta
    </Link>
  )
  if (donde === 'hoja') return (
    <>
      {iniciar}
      <Link href={`/expediente/${cita.paciente_id}`} prefetch={false}
        className="mt-3 flex min-h-12 items-center gap-3 border-t border-linea pt-3 text-[15px] text-tinta">
        <Folder aria-hidden="true" className="size-5 text-enlace" /> Ver expediente
      </Link>
    </>
  )
  return (
    <>
      {iniciar}
      {/* Expediente, sólo icono (su nombre accesible de siempre). */}
      <Link href={`/expediente/${cita.paciente_id}`} prefetch={precarga} aria-label="Abrir expediente" title="Expediente"
        className="k-b k-b-tonal h-11 w-11 px-0 ih:h-10 ih:w-10 esc:h-10 esc:w-10">
        <Folder aria-hidden="true" className="size-5" />
      </Link>
    </>
  )
}

/** Las acciones de la cabecera: buscador y los cuatro botones (tres en ext, CALMA §17). */
function CabeceraAcciones({ onBuscar, onConsulta, onDocumento }: {
  onBuscar: () => void; onConsulta: () => void; onDocumento: () => void
}): ReactElement {
  return (
    <div className={`${HUECO.acciones} flex flex-col gap-3`}>
      <BuscadorPaciente onAbrir={onBuscar} />
      <div className="order-2 grid grid-cols-2 gap-2 ext:grid-cols-3 ih:grid-cols-4 iv:grid-cols-4">
        {/* En ext la da el «+» del riel (`Sidebar.tsx`): no se repite aquí. */}
        <button type="button" onClick={onConsulta} className={`${BOTON_ACCION} bg-tonal text-tonal-tinta ext:hidden`}>
          <Plus aria-hidden="true" className="size-[18px] ih:hidden iv:hidden" /> Nueva consulta
        </button>
        {/* Abre el MISMO buscador que «Nueva consulta», con destino al taller de
            documentos del elegido (pulido de flujo, ítem 1). */}
        <button type="button" onClick={onDocumento} aria-label="Nuevo documento" className={BOTON_SUP}>
          <Corto icono={<FilePlus2 aria-hidden="true" className="size-[18px] ih:hidden iv:hidden" />} largo="Nuevo documento" corto="Documento" />
        </button>
        {/* ⚠️ NO LO QUITES NI LO MUEVAS A OTRO NODO. `OnboardingGuide` lo busca
            por `[data-onboard="nuevo-paciente"]`. Sin precarga (2 RSC + 2
            lambdas por carga, se pulse o no). */}
        <Link href="/pacientes/nuevo" data-onboard="nuevo-paciente" prefetch={false} aria-label="Nuevo paciente" className={BOTON_SUP}>
          <Corto icono={<UserPlus aria-hidden="true" className="size-[18px] ih:hidden iv:hidden" />} largo="Nuevo paciente" corto="Paciente" />
        </Link>
        <Link href="/expediente" prefetch={false} className={BOTON_SUP}>
          <FolderOpen aria-hidden="true" className="size-[18px] ext:hidden ih:hidden iv:hidden" /> Expedientes
        </Link>
      </div>
    </div>
  )
}

/** Rótulo completo, o «+ Palabra» en ext (CALMA §17); el nombre accesible lo lleva el botón. */
function Corto({ icono, largo, corto }: { icono: ReactNode; largo: string; corto: string }): ReactElement {
  return (
    <>
      <span className="contents ext:hidden">{icono}{largo}</span>
      <span className="hidden items-center gap-1 ext:inline-flex"><Plus aria-hidden="true" className="size-4" />{corto}</span>
    </>
  )
}

/* ─── Componente ──────────────────────────────────────────── */

export default function DashboardPage(): ReactElement {
  const { profile, loading: loadingProfile } = useProfile()
  const { consultorios } = useConsultorios()
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()
  const [modalConsulta, setModalConsulta] = useState(false)
  /* El buscador de «Nuevo documento», que es el MISMO componente con otro
     destino. Estado aparte: los dos botones son independientes y así ninguno
     puede heredar el destino del otro por un reset olvidado. */
  const [modalDocumento, setModalDocumento] = useState(false)
  /* Tanda J (punto 6) · La fila por ligar cuya ventana está abierta, y cómo quitarla si «¿No es una cita?». */
  const [ligando, setLigando] = useState<{ id: string; alQuitar: () => void } | null>(null)
  /* El escudo de siempre: el segundo clic de un doble clic sobre el botón no cae en la ventana. */
  const escudoLigar = useEscudoTrasRegistro(ligando === null, { dentroDeDialogos: true })

  /* ⚠️ ESTA DECLARACIÓN VA ANTES DE LOS GUARDAS: el esqueleto la recibe como
     prop, y un `const` no se eleva. */
  const abrirBusqueda = (): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  }

  /* El esqueleto lleva la búsqueda VIVA. El guarda de rol de la línea
     siguiente no se mueve: durante la carga el rol se desconoce, así que una
     secretaria no ve ni un fotograma de esta cabecera. */
  if (loadingProfile) return <DashboardSkeleton onBuscar={abrirBusqueda} />
  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  const primerNombre = profile?.nombres ? profile.nombres.split(' ')[0] : ''
  /* Deja activo el consultorio de la cita antes de entrar a la nota, para que
     el documento salga con el membrete que toca. */
  const activarDe = (cita: Cita) => (): void => {
    const c = cita.consultorio_id ? consultorios.find(x => x.id === cita.consultorio_id) : undefined
    if (c) cambiarActivo(c)
  }
  /* Tanda J (punto 6) · «Ligar paciente e iniciar consulta» (la ventana
     pequeña), con las condiciones de la agenda (`puedeIniciarConsulta`: médico
     de la cita, con su consultorio). Si no, `null` y queda «Ver en la agenda». */
  const ligar = (cita: Cita, _enCurso: boolean, alQuitar: () => void, donde: Donde): ReactNode => {
    const conConsultorio = cita.consultorio_id ? consultorios.some(c => c.id === cita.consultorio_id)
      : esPorAsignar(cita) && consultorios.length > 0
    /* Las filas de esta lista son todas del médico que mira (`medicoId`). */
    if (!(profile?.role === 'medico' && esPorLigar(cita) && conConsultorio)) return null
    return (
      <button type="button" onClick={() => { escudoLigar.activar(); setLigando({ id: cita.id, alQuitar }) }}
        aria-label={`Ligar paciente e iniciar consulta de ${nombreDeCita(cita)}`}
        className={`k-b k-b-prim whitespace-normal py-2 text-center ${donde === 'hoja' ? 'k-b-capa h-auto min-h-11 w-full' : 'h-auto min-h-11 flex-1 ih:min-h-10 ih:flex-none iv:flex-none esc:min-h-10 esc:flex-none'}`}>
        <Link2 aria-hidden="true" className="size-[18px]" /> Ligar paciente e iniciar consulta
      </button>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1044px] flex-col gap-5 pb-6 pt-2 esc:gap-6">
      {/* La cabecera: identidad y «Hoy» (la tarjeta del día fundida en ella). */}
      <header className="flex flex-col gap-4 esc:flex-row esc:flex-wrap esc:items-end esc:justify-between esc:gap-x-8 esc:gap-y-4">
        <Identidad ceja={consultorioActivo ? (consultorioActivo.nombre_corto || consultorioActivo.nombre) : ''} nombre={primerNombre} />
        <TarjetaHoy medicoId={profile?.id ?? null} />
      </header>

      <div className={RETICULA}>
        {/* ⚠️ LAS ACCIONES CLÍNICAS DE UNA CITA VIVEN AQUÍ, no dentro de
            `ProximasCitas`: ese componente lo comparte la vista de la
            secretaria, donde expediente y nota están PROHIBIDOS por el rol. */}
        <ProximasCitas
          medicoId={profile?.id ?? null}
          claseHero={HUECO.hero}
          claseLista={HUECO.lista}
          ligar={ligar}
          acciones={(cita, enCurso, donde) => <AccionesCita cita={cita} enCurso={enCurso} donde={donde} alIniciar={activarDe(cita)} />}
        />
        <CabeceraAcciones onBuscar={abrirBusqueda} onConsulta={() => setModalConsulta(true)} onDocumento={() => setModalDocumento(true)} />
        <div className={HUECO.atendidos}><AtendidosRecientemente /></div>
        <div className={HUECO.documentos}><DocumentosRecientes onNuevoDocumento={() => setModalDocumento(true)} /></div>
      </div>

      {/* Cuelgan de los botones de la cabecera. Fuera de la retícula: se pintan
          en `position: fixed` y devuelven `null` cerrados. */}
      <ConsultaRapidaModal open={modalConsulta} onClose={() => setModalConsulta(false)} />
      <ConsultaRapidaModal
        open={modalDocumento}
        onClose={() => setModalDocumento(false)}
        destino={id => `/expediente/${id}/documentos`}
        titulo="Nuevo documento"
        rotuloCrear="Crear y continuar"
      />
      {/* Tanda J (punto 6) · «Ligar e iniciar consulta» de una cita por ligar. */}
      {ligando && (
        <VentanaLigarCita citaId={ligando.id} alCerrar={() => setLigando(null)} alNoEsCita={ligando.alQuitar} />
      )}
    </div>
  )
}
