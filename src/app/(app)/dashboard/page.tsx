'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { FolderOpen, Plus, Stethoscope, FilePlus2 } from 'lucide-react'
import Link from 'next/link'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
/* El «+ Nueva consulta» de la cabecera. Vive en `components/launcher/` porque
   nació en `(launcher)/inicio`; aquí sólo se importa —esa página no se toca—.
   Es la ÚNICA pieza de la app que hace lo que pide la adenda §1: elegir
   paciente (o crearlo) y entrar a la nota SIN exigir cita previa. */
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import ProximasCitas, { GEOMETRIA_ACCION } from '@/components/dashboard/ProximasCitas'
import TarjetaHoy from '@/components/dashboard/TarjetaHoy'
import AtendidosRecientemente from '@/components/dashboard/AtendidosRecientemente'
import DocumentosRecientes from '@/components/dashboard/DocumentosRecientes'
import BuscadorPaciente, { ALTO_CONTROL } from '@/components/dashboard/BuscadorPaciente'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import { esPorAsignar, esPorLigar } from '@/lib/agenda/tarjetasAgenda'

/* Tanda J (punto 6) · La ventana de «Ligar e iniciar consulta», en su propio
   chunk: sólo se descarga al pulsar el botón de una fila por ligar. */
const VentanaLigarCita = dynamic(() => import('@/components/agenda/VentanaLigarCita'), { ssr: false })

/* ─── Helpers ─────────────────────────────────────────────── */

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/* ─── Tipos ───────────────────────────────────────────────── */

/* ─── Config ──────────────────────────────────────────────── */

/* ─── Componente ──────────────────────────────────────────── */

export default function DashboardPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const { consultorios } = useConsultorios()
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()
  const [modalConsulta, setModalConsulta] = useState(false)
  /* El buscador de «Nuevo documento», que es el MISMO componente con otro
     destino. Estado aparte y no uno compartido con tres valores: los dos
     botones son independientes y así ninguno puede heredar el destino del
     otro por un reset olvidado. */
  const [modalDocumento, setModalDocumento] = useState(false)
  /* Tanda J (punto 6) · La fila por ligar cuya ventana está abierta, y cómo quitarla si «¿No es una cita?». */
  const [ligando, setLigando] = useState<{ id: string; alQuitar: () => void } | null>(null)
  /* El escudo de siempre: el segundo clic de un doble clic sobre el botón no cae en la ventana. */
  const escudoLigar = useEscudoTrasRegistro(ligando === null, { dentroDeDialogos: true })


  /* ⚠️ ESTA DECLARACIÓN VA ANTES DE LOS GUARDAS, y no es orden estético: el
     esqueleto de la línea de abajo la recibe como prop, y un `const` no se
     eleva. Bajarla otra vez rompe la carga con un error de zona muerta. */
  const abrirBusqueda = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

  /* El esqueleto lleva la búsqueda VIVA: no depende del perfil, y es lo
     primero que se toca en esta pantalla. El manejador se le pasa en vez de que
     lo fabrique, para que el Ctrl+K sintético siga definido en un solo sitio
     (el menú es el encabezado fundido de la navegación, B4). El guarda de rol de la línea siguiente no se
     mueve: durante la carga el rol se desconoce, así que el esqueleto deja los
     tres botones en hueso y una secretaria no ve ni un fotograma de esta
     cabecera. */
  if (loadingProfile) return <DashboardSkeleton onBuscar={abrirBusqueda} />
  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  const primerNombre = profile?.nombres ? profile.nombres.split(' ')[0] : ''
  /* Sin perfil —error de carga— el saludo cae a la fórmula neutra; la ceja de
     consultorio simplemente no se pinta. */

  return (
    <div className="max-w-[1044px] mx-auto pt-2 pb-6">

      {/* ── Región 1 · Cabecera de acción (adenda §1) ─────────── */}
      <div className="animate-slide-up pb-[var(--sp-5-5)] border-b border-[color:var(--sp-line-card)]" style={{ animationDelay: '0ms' }}>

        {/* La barra móvil propia (`.dash-barra-movil`: hamburguesa, «Dashboard»
            y avatar) se fue en B4 del rediseño: ahora la cabecera de `tel`/`iv`
            es el encabezado fundido de `Sidebar.tsx`, el mismo en toda la app. */}

        {/* ── Fila 1 · identidad ──────────────────────────────── */}
        {consultorioActivo && (
          <p className="sp-label truncate">{consultorioActivo.nombre_corto || consultorioActivo.nombre}</p>
        )}
        <h1 className="mt-[var(--sp-gap-title-sub)] text-[length:var(--sp-fs-page)] font-extrabold tracking-tight leading-tight text-[var(--sp-ink-900)]">
          {saludo()}{primerNombre ? `, ${primerNombre}` : ''}
        </h1>

        {/* ── Fila 2 · acción ─────────────────────────────────────
            ⚠️ UN SOLO JUEGO DE CONTROLES PARA LOS DOS TAMAÑOS, y es a
            propósito: duplicar el bloque para móvil pondría `data-onboard` en
            dos nodos y `OnboardingGuide` resuelve por `querySelector`, o sea
            por el PRIMERO que encuentre. El orden lo dan las utilidades
            `order-*`; el marcado es uno.
            En `lg` el grupo es `shrink-0`, así que si no cabe baja de línea
            ENTERO y conserva su orden, en vez de descolgarse de uno en uno.
            ⚠️ EN MÓVIL SON CUATRO BOTONES Y EN ESCRITORIO TRES: «+ Nuevo
            documento» es el único que trae `lg:hidden`, porque en `lg` ese
            botón sigue viviendo arriba de la columna de Documentos, que es
            donde estaba. Es la ÚNICA asimetría del bloque, y no la hereda
            `data-onboard`: ese atributo sigue en un solo nodo. */}
        <div className="mt-[var(--sp-gap-block)] flex flex-col gap-[var(--sp-gap-item)] lg:flex-row lg:flex-wrap lg:items-center">

          <BuscadorPaciente onAbrir={abrirBusqueda} />

          {/* Los botones. En móvil, retícula de dos columnas donde las dos
              primeras filas cruzan las dos columnas y el par queda en la
              tercera; en `lg`, fila de tres que no encoge. */}
          <div className="order-2 grid grid-cols-2 gap-[var(--sp-gap-item)] lg:flex lg:shrink-0 lg:items-center">

            {/* + Nueva consulta — primario. `.sp-btn--primary` trae del sistema
                el fondo, la tinta y la sombra: aquí no hay ningún color. */}
            <button
              type="button"
              onClick={() => setModalConsulta(true)}
              className={`${ALTO_CONTROL} sp-btn sp-btn--primary col-span-2 order-1 whitespace-nowrap lg:order-3`}
            >
              <Plus size={17} /> Nueva consulta
            </button>

            {/* + Nuevo documento — SÓLO MÓVIL, fila propia a ancho completo.
                ⚠️ NO ES UN SEGUNDO PRIMARIO. Ocupa las dos columnas y mide lo
                mismo que «Nueva consulta» —eso lo pidió el diseño—, pero lleva
                el contorno de acento de «Nuevo paciente», no el relleno: en
                esta cabecera el relleno macizo es de UNO y sirve para señalar
                cuál es la acción principal. Dos rellenos seguidos dejan la
                pantalla sin jerarquía.
                Está aquí y no al final de la columna de Documentos porque
                apiladas en móvil esa columna cae al pie de la página, a dos
                pantallas de las demás acciones de creación. En `lg` no se
                pinta: allí el botón de la columna sigue siendo el que vale.
                El rótulo va entero, sin abreviar. A 360 px la fila mide 328 y
                el botón pide 197-228 según la fuente de sistema, así que sobra;
                en media columna (159) NO cabía, y de ahí la fila propia.
                ⚠️ DEJÓ DE SER UN ENLACE (pulido de flujo, ítem 1). Antes iba a
                `/documentos`, la pantalla intermedia donde había que elegir
                paciente; ahora abre el mismo buscador que «Nueva consulta» y
                entra al expediente del elegido. Sin `?tipo=`: el formato se
                elige ya dentro, sobre las ocho tarjetas. */}
            <button
              type="button"
              onClick={() => setModalDocumento(true)}
              className={`${ALTO_CONTROL} col-span-2 order-2 inline-flex items-center justify-center gap-[var(--sp-gap-item)] whitespace-nowrap rounded-[var(--sp-r-btn)] px-6 border border-[color:var(--sp-primary-border)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-primary-text)] transition-colors hover:bg-[var(--sp-primary-bg-faint)] lg:hidden`}
            >
              <FilePlus2 size={17} /> Nuevo documento
            </button>

            {/* + Nuevo paciente — contorno de acento. No lleva `.sp-btn`
                porque ésa declara `border: none` y se comería el contorno. */}
            <Link
              href="/pacientes/nuevo"
              /* ⚠️ NO LO QUITES NI LO MUEVAS A OTRO NODO. `OnboardingGuide` lo
                 busca por `[data-onboard="nuevo-paciente"]` para señalar este
                 paso de la guía; sin él el paso queda mudo. */
              data-onboard="nuevo-paciente"
              /* Sin precarga, como el resto de enlaces nuevos de esta región:
                 2 peticiones RSC y 2 lambdas por carga del dashboard, se pulse
                 o no. El razonamiento largo está en la lista de recientes. */
              prefetch={false}
              className={`${ALTO_CONTROL} order-3 inline-flex items-center justify-center gap-[var(--sp-gap-item)] whitespace-nowrap rounded-[var(--sp-r-btn)] px-6 border border-[color:var(--sp-primary-border)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-primary-text)] transition-colors hover:bg-[var(--sp-primary-bg-faint)] lg:order-2`}
            >
              <Plus size={17} /> Nuevo paciente
            </Link>

            {/* Expedientes — contorno neutro, el visor global. */}
            <Link
              href="/expediente"
              /* Sin precarga, y desde el bloque 5 el ahorro ES real: la
                 salvedad que había aquí —que la tarjeta «Expediente» de
                 `ACCESOS` conservaba la suya a la misma url, y Next deduplica
                 por url— se fue con la columna de Módulos. Ya no queda ningún
                 otro enlace encendido a `/expediente` en esta pantalla. */
              prefetch={false}
              className={`${ALTO_CONTROL} sp-btn sp-btn--secondary order-4 whitespace-nowrap lg:order-1`}
            >
              <FolderOpen size={17} /> Expedientes
            </Link>

          </div>
        </div>
      </div>

      {/* Cuelga de «+ Nueva consulta» de la cabecera. Va fuera del bloque
          porque se pinta en `position: fixed` y devuelve `null` cerrado: no
          entra en el flujo de ninguna banda. */}
      <ConsultaRapidaModal open={modalConsulta} onClose={() => setModalConsulta(false)} />

      {/* El gemelo de documentos. Mismo componente, mismo sitio y misma razón
          —`position: fixed`, `null` cerrado—; lo único que cambia es a dónde
          entra el paciente elegido. Lo abren los DOS botones de la pareja: el
          de la cabecera en móvil y el de la columna de Documentos en `lg`. */}
      <ConsultaRapidaModal
        open={modalDocumento}
        onClose={() => setModalDocumento(false)}
        destino={id => `/expediente/${id}/documentos`}
        titulo="Nuevo documento"
        rotuloCrear="Crear y continuar"
      />

      {/* Tanda J (punto 6) · «Ligar e iniciar consulta» de una fila por ligar. */}
      {ligando && (
        <VentanaLigarCita citaId={ligando.id} alCerrar={() => setLigando(null)} alNoEsCita={ligando.alQuitar} />
      )}

      {/* ── Banda 1 · Próximas citas (flexible) · columna fija ── */}
      {/* ⚠️ `items-start`: LAS DOS COLUMNAS SE ALINEAN ARRIBA Y NINGUNA SE
          ESTIRA. Por defecto una retícula estira sus hijos al alto de la fila,
          así que con una sola cita la card de la izquierda crecía hasta igualar
          al calendario y dejaba un blanco grande DENTRO de una caja con borde.
          El sobrante tiene que ser aire de la retícula, no hueco enmarcado. */}
      <div className="grid grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-5)] mt-[var(--sp-gap-band)] animate-slide-up" style={{ animationDelay: '60ms' }}>

        {/* ⚠️ EL ORDEN DEL DOM ES EL DE ESCRITORIO, Y MÓVIL LO INVIERTE CON
            `order`. En una columna, el calendario va PEGADO A LA CABECERA y las
            próximas citas debajo; en `lg` vuelve la retícula de dos columnas con
            las citas a la izquierda. Se hace con `order` y no reordenando el
            marcado porque el orden de lectura de escritorio —citas primero— es
            también el orden de tabulación que queremos allí.
            Los envoltorios existen sólo para colgar el `order`: la retícula
            sigue teniendo EXACTAMENTE DOS HIJOS, que es criterio de la adenda. */}

        {/* ── Región 2 · Próximas citas ─────────────────────── */}
        <div className="order-2 lg:order-1">
          {/* ⚠️ LAS DOS ACCIONES CLÍNICAS DEL RENGLÓN VIVEN AQUÍ, no dentro de
              `ProximasCitas`. Ese componente lo comparte la vista de la
              secretaria, donde expediente y nota están PROHIBIDOS por el rol, y
              tenerlas fuera es lo que lo hace cierto por estructura en vez de
              por una bandera. No las muevas de vuelta.
              La precarga y el tratamiento primario siguen la regla de la
              región: sólo la fila en curso. */}
          <ProximasCitas
            medicoId={profile?.id ?? null}
            /* Tanda J (punto 6) · Una fila por ligar o por asignar: «Ligar e
               iniciar consulta» (la ventana pequeña), con las condiciones de la
               agenda (las de `puedeIniciarConsulta`: médico de la
               cita, con su consultorio). Si no, `null` y queda «Ver en la agenda». */
            ligar={(cita, enCurso, alQuitar) => {
              const conConsultorio = cita.consultorio_id ? consultorios.some(c => c.id === cita.consultorio_id)
                : esPorAsignar(cita) && consultorios.length > 0
              /* Las filas de esta lista son todas del médico que mira (`medicoId`). */
              const puede = profile?.role === 'medico' && esPorLigar(cita) && conConsultorio
              if (!puede) return null
              return (
                <button type="button" onClick={() => { escudoLigar.activar(); setLigando({ id: cita.id, alQuitar }) }}
                  aria-label={`Ligar e iniciar consulta de ${cita.reserva_nombre ?? cita.title}`}
                  className={enCurso ? 'sp-btn sp-btn--primary whitespace-nowrap' : 'inline-flex items-center justify-center whitespace-nowrap border font-bold transition-colors'}
                  style={enCurso ? GEOMETRIA_ACCION
                    : { ...GEOMETRIA_ACCION, background: 'var(--sp-surface)', color: 'var(--sp-primary-text)', borderColor: 'var(--sp-primary-border)' }}>
                  {/* En la de Google comparte la fila con «¿No es una cita?»: el rótulo largo no cabe ni a 1280. */}
                  <span className={esPorAsignar(cita) ? '' : 'xl:hidden'}>Ligar</span>
                  {!esPorAsignar(cita) && <span className="hidden xl:inline">Ligar e iniciar consulta</span>}
                </button>
              )
            }}
            acciones={(cita, enCurso) => {
              const precarga = enCurso ? undefined : false
              return (
                <>
                  <Link
                    href={`/expediente/${cita.paciente_id}/nueva-nota?cita=${cita.id}`}
                    onClick={() => {
                      /* Deja activo el consultorio de la cita antes de entrar a
                         la nota, para que el documento salga con el membrete
                         que toca. */
                      if (!cita.consultorio_id) return
                      const c = consultorios.find(x => x.id === cita.consultorio_id)
                      if (c) cambiarActivo(c)
                    }}
                    prefetch={precarga}
                    className={enCurso
                      ? 'sp-btn sp-btn--primary whitespace-nowrap'
                      : 'inline-flex items-center justify-center whitespace-nowrap border font-bold transition-colors'}
                    style={enCurso
                      ? GEOMETRIA_ACCION
                      : { ...GEOMETRIA_ACCION, background: 'var(--sp-surface)', color: 'var(--sp-primary-text)', borderColor: 'var(--sp-primary-border)' }}
                  >
                    <span className="xl:hidden">Iniciar</span>
                    <span className="hidden xl:inline">Iniciar consulta</span>
                  </Link>

                  {/* Expediente, sólo icono. `Stethoscope` es el glifo que la app
                      ya usa para «expediente». Se cae por debajo de 380 px de
                      viewport: es la regla de degradación de la adenda, y lo que
                      protege es que el renglón quepa en una línea. */}
                  <Link
                    href={`/expediente/${cita.paciente_id}`}
                    prefetch={precarga}
                    aria-label="Abrir expediente"
                    title="Expediente"
                    className="hidden min-[380px]:inline-flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-[var(--sp-r-btn-sm)] border border-[color:var(--sp-line-control)] bg-[var(--sp-surface)] text-[var(--sp-ink-500)] transition-colors hover:bg-[var(--sp-surface-muted)] hover:text-[var(--sp-ink-700)]"
                  >
                    <Stethoscope size={16} />
                  </Link>
                </>
              )
            }}
          />
        </div>

        {/* ── Región 3 · Calendario «Hoy es» ────────────────── */}
        <div className="order-1 lg:order-2">
          <TarjetaHoy medicoId={profile?.id ?? null} />
        </div>

      </div>

      {/* Filete horizontal a TODO el ancho del área de contenido, no sólo
          a la columna izquierda (adenda §3). */}
      <div className="mt-[var(--sp-gap-band)] border-t border-[color:var(--sp-line-card)]" />

      {/* ── Banda 2 · Atendidos (flexible) · Documentos (fija) ── */}
      {/* ⚠️ EXACTAMENTE DOS HIJOS, y es criterio de aceptación de la adenda §3.
          Cada columna se pinta SIEMPRE: sus estados de carga, vacío y error
          viven dentro del componente, nunca como un guarda que la borre de la
          retícula. Un `&&` aquí fuera dejaría la banda con un solo hijo en
          cuenta nueva y descolgaría el filete vertical. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-gap-band)] lg:gap-0 mt-[var(--sp-gap-band)]">
        {/* ── Región 5 · Atendidos recientemente ──────────────── */}
        <div className="lg:pr-[var(--sp-pad-rule)]">
          <AtendidosRecientemente />
        </div>

        {/* ── Región 4 · Documentos ──────────────────────────────
            No es una tarjeta con marco: es una columna de contenido, y el
            filete vertical de la adenda §4 es su borde izquierdo, con 24 px a
            cada lado. */}
        {/* ⚠️ EL FILETE CAMBIA DE LADO CON EL TAMAÑO. En `lg` es el borde
            IZQUIERDO de esta columna —el filete vertical de la adenda §4, con
            24 px a cada lado—. Apiladas en móvil no hay costado que separar y
            las dos secciones se pegaban, así que ahí pasa a ser el borde
            SUPERIOR, el mismo filete de 1 px que separa las bandas, con los
            14 px de relleno que pide el spec para móvil. Es uno o el otro,
            nunca los dos: de ahí los `lg:border-t-0 lg:pt-0`. */}
        <div className="border-t border-[color:var(--sp-line-card)] pt-[var(--sp-3-5)] lg:border-t-0 lg:pt-0 lg:border-l lg:pl-[var(--sp-pad-rule)]">
          <DocumentosRecientes onNuevoDocumento={() => setModalDocumento(true)} />
        </div>
      </div>

    </div>
  )
}
