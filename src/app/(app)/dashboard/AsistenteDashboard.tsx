'use client'

import Link from 'next/link'
import { Menu, Plus, User, CalendarPlus } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useClinica } from '@/hooks/useClinica'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import BuscadorPaciente, { ALTO_CONTROL } from '@/components/dashboard/BuscadorPaciente'
import ProximasCitas, { GEOMETRIA_ACCION } from '@/components/dashboard/ProximasCitas'
import TarjetaHoy from '@/components/dashboard/TarjetaHoy'
import UltimosPacientes from '@/components/dashboard/UltimosPacientes'
import HoyEnConsultorio from '@/components/dashboard/HoyEnConsultorio'

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * El inicio del rol asistente médico/a.
 *
 * Misma retícula, densidad y piezas que la del médico —dos bandas separadas por
 * un filete, columna flexible y columna fija— con el ALCANCE RECORTADO DEL ROL.
 *
 * ⚠️ NADA CLÍNICO ES ALCANZABLE DESDE AQUÍ, Y ES UNA FRONTERA, NO UN DESCUIDO.
 * No hay expediente, ni notas, ni documentos, ni «iniciar consulta»; el renglón
 * de una cita no enseña diagnóstico ni motivo, y la única acción sobre un
 * paciente es «Agendar». Las acciones del renglón las pinta ESTE archivo —
 * `ProximasCitas` no conoce ninguna url clínica—, así que la garantía es
 * estructural: para romperla habría que escribir la url aquí a mano.
 */
export default function AsistenteDashboard() {
  const { profile } = useProfile()
  const { clinica, nombreDisplay } = useClinica()
  const { abrir: abrirMenu } = useMenuMovil()
  const primerNombre = profile?.nombres ? profile.nombres.split(' ')[0] : ''
  const iniciales = `${profile?.nombres?.[0] ?? ''}${profile?.apellido_paterno?.[0] ?? ''}`.toUpperCase()

  /* ⚠️ EL RESPALDO ES `clinicas.nombre`, NO EL NOMBRE DEL USUARIO. La versión
     anterior componía aquí un nombre de médico a mano —con un literal escrito
     en el archivo— y para una secretaria eso da cadena vacía: ella no es la
     médica del consultorio. Se prefiere el nombre de marca (`nombre_display`)
     cuando existe, y si no el legal (`clinicas.nombre`); si tampoco hay, la
     ceja no se pinta en vez de dejar un hueco. El dato es de SÓLO LECTURA para
     este rol: su edición vive en Mi perfil, restringida al administrador. */
  const nombreClinica = nombreDisplay ?? clinica?.nombre ?? ''

  const abrirBusqueda = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

  return (
    <div className="max-w-[1044px] mx-auto pt-2 pb-6">

      {/* ── Región 2 · Cabecera de acción ────────────────────── */}
      <div className="animate-slide-up pb-[var(--sp-5-5)] border-b border-[color:var(--sp-line-card)]" style={{ animationDelay: '0ms' }}>

        {/* Misma barra móvil que la del médico, con el mismo asidero: las dos
            reglas de `globals.css` esconden el hamburguesa flotante y recortan
            el relleno que el layout le reserva. */}
        <div className="dash-barra-movil lg:hidden flex items-center gap-[var(--sp-3)] mb-[var(--sp-gap-block)]">
          <button
            type="button"
            onClick={abrirMenu}
            aria-label="Abrir menú"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-surface-muted)] text-[var(--sp-ink-700)]"
          >
            <Menu size={20} />
          </button>
          <p className="flex-1 min-w-0 truncate text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
            Dashboard
          </p>
          <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] bg-[var(--sp-primary-bg)] text-[var(--sp-primary-ink)] text-[length:var(--sp-fs-label-sm)] font-extrabold">
            {iniciales || <User size={18} />}
          </div>
        </div>

        {/* Fila 1 · identidad. Encabeza el NOMBRE DE LA CLÍNICA, que es lo que
            el spec muda aquí desde la barra lateral. */}
        {nombreClinica && <p className="sp-label truncate">{nombreClinica}</p>}
        <h1 className="mt-[var(--sp-gap-title-sub)] text-[length:var(--sp-fs-page)] font-extrabold tracking-tight leading-tight text-[var(--sp-ink-900)]">
          {saludo()}{primerNombre ? `, ${primerNombre}` : ''}
        </h1>

        {/* Fila 2 · acción. DOS botones, no tres: el rol no crea documentos ni
            consultas. El primario es «Agendar cita», que es la acción más
            frecuente del puesto. */}
        <div className="mt-[var(--sp-gap-block)] flex flex-col gap-[var(--sp-gap-item)] lg:flex-row lg:flex-wrap lg:items-center">
          <BuscadorPaciente onAbrir={abrirBusqueda} />

          <div className="order-2 grid grid-cols-2 gap-[var(--sp-gap-item)] lg:flex lg:shrink-0 lg:items-center">
            <Link
              href="/agenda"
              prefetch={false}
              className={`${ALTO_CONTROL} sp-btn sp-btn--primary col-span-2 order-1 whitespace-nowrap lg:order-2`}
            >
              <CalendarPlus size={17} /> Agendar cita
            </Link>

            <Link
              href="/pacientes/nuevo"
              /* `data-onboard` NO va aquí: vive en el botón del dashboard del
                 médico y `OnboardingGuide` resuelve por `querySelector`, o sea
                 por el primer nodo del DOM. Dos marcas romperían aquel paso. */
              prefetch={false}
              className={`${ALTO_CONTROL} order-2 col-span-2 inline-flex items-center justify-center gap-[var(--sp-gap-item)] whitespace-nowrap rounded-[var(--sp-r-btn)] px-6 border border-[color:var(--sp-primary-border)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-primary-text)] transition-colors hover:bg-[var(--sp-primary-bg-faint)] lg:order-1 lg:col-span-1`}
            >
              <Plus size={17} /> Nuevo paciente
            </Link>
          </div>
        </div>
      </div>

      {/* ── Banda 1 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-5)] mt-[var(--sp-gap-band)] animate-slide-up" style={{ animationDelay: '60ms' }}>

        <div className="order-2 lg:order-1">
          {/* ⚠️ `medicoId={null}` = TODAS LAS CITAS DE LA CLÍNICA, y con ello el
              renglón enseña de quién es cada una. La secretaria no tiene citas
              propias, así que filtrar por ella no tendría sentido.
              ⚠️ Y LA ÚNICA ACCIÓN ES «VER CITA», que navega a la agenda SIN
              parámetros: el detalle por url se descartó porque el modal espera
              la fila entera. No añadas aquí expediente ni nota. */}
          <ProximasCitas
            medicoId={null}
            acciones={(cita, enCurso) => (
              <Link
                href="/agenda"
                prefetch={enCurso ? undefined : false}
                aria-label={`Ver la cita de ${cita.pacientes ? `${cita.pacientes.nombre} ${cita.pacientes.apellidos}` : cita.title} en la agenda`}
                className={enCurso
                  ? 'sp-btn sp-btn--primary whitespace-nowrap'
                  : 'inline-flex items-center justify-center whitespace-nowrap border font-bold transition-colors'}
                style={enCurso
                  ? GEOMETRIA_ACCION
                  : { ...GEOMETRIA_ACCION, background: 'var(--sp-surface)', color: 'var(--sp-primary-text)', borderColor: 'var(--sp-primary-border)' }}
              >
                <span className="xl:hidden">Ver</span>
                <span className="hidden xl:inline">Ver cita</span>
              </Link>
            )}
          />
        </div>

        <div className="order-1 lg:order-2">
          {/* Sin médico: el conteo es de la clínica entera. */}
          <TarjetaHoy medicoId={null} />
        </div>
      </div>

      <div className="mt-[var(--sp-gap-band)] border-t border-[color:var(--sp-line-card)]" />

      {/* ── Banda 2 · exactamente dos hijos ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-gap-band)] lg:gap-0 mt-[var(--sp-gap-band)]">
        <div className="lg:pr-[var(--sp-pad-rule)]">
          <UltimosPacientes />
        </div>

        <div className="border-t border-[color:var(--sp-line-card)] pt-[var(--sp-3-5)] lg:border-t-0 lg:pt-0 lg:border-l lg:pl-[var(--sp-pad-rule)]">
          <HoyEnConsultorio />
        </div>
      </div>
    </div>
  )
}
