'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X, Loader2, ChevronRight, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { calcularEdad } from '@/lib/patientUtils'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import Avatar, { inicialesDe } from '@/components/ui/Avatar'
import SelectorTipoDocumento, { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'

const FormLoader = () => (
  <div className="flex items-center justify-center gap-2 py-16 text-tinta2" role="status">
    <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <span className="text-[15px]">Cargando formulario...</span>
  </div>
)

const FormError = () => (
  <div className="flex flex-col items-center justify-center gap-1 py-16 text-center" role="alert">
    <p className="text-[15px] font-semibold text-tinta">No se pudo cargar el formulario</p>
    <p className="text-[13px] text-tinta2">Verifica tu conexion e intenta de nuevo</p>
  </div>
)

function safeDynamic<T extends Record<string, unknown>>(loader: () => Promise<{ default: React.ComponentType<T> }>) {
  return dynamic<T>(
    () => loader().catch(() => ({
      default: (() => FormError()) as unknown as React.ComponentType<T>,
    })),
    { ssr: false, loading: FormLoader },
  )
}

const RecetaForm              = safeDynamic(() => import('@/components/documentos/RecetaForm'))
const SolicitudLabForm        = safeDynamic(() => import('@/components/documentos/SolicitudLabForm'))
const SolicitudImagenForm     = safeDynamic(() => import('@/components/documentos/SolicitudImagenForm'))
const PlanSuplementacionForm  = safeDynamic(() => import('@/components/documentos/PlanSuplementacionForm'))
const SolicitudInternamientoForm = safeDynamic(() => import('@/components/documentos/SolicitudInternamientoForm'))
const EscritoMedicoForm       = safeDynamic(() => import('@/components/documentos/EscritoMedicoForm'))
const ConsentimientoForm      = safeDynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'))
const NotaHonorariosForm      = safeDynamic(() => import('@/components/documentos/NotaHonorariosForm'))

// `fecha_nacimiento` es opcional porque el alta rápida devuelve un paciente sin
// ella: quien no la tenga entra al consentimiento con la edad en blanco.
type Paciente = { id: string; nombre: string; apellidos: string; fecha_nacimiento?: string | null; alergias?: string | null }

function DocumentosContent() {
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState<TipoDocumento | null>(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [showQuickPatient, setShowQuickPatient] = useState(false)
  // Los ocho reportan predicado: los siete del sistema de plantillas
  // —Receta, Laboratorio, Imagen, Suplementación, Escrito, Internamiento,
  // Consentimiento— más Honorarios.
  const [formVacio, setFormVacio] = useState(true)
  // El panel de plantillas sustituye al formulario y oculta el selector de tipo.
  const [panelPlantillas, setPanelPlantillas] = useState(false)

  useEffect(() => {
    const t = searchParams.get('tipo') as TipoDocumento | null
    if (t && TIPOS_DOCUMENTO.some(x => x.key === t)) setTipo(t)
  }, [searchParams])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)

      const supabase = createClient()
      const busquedaNorm = busqueda.trim().replace(/\s+/g, ' ')
      const { data, error } = await supabase
        .from('pacientes')
        // `fecha_nacimiento` no la pinta el buscador: la necesita el
        // consentimiento, que prellena la edad de la ficha (§5 de su guía).
        // `alergias`, la cabecera de la receta (CALMA §23.4).
        .select('id, nombre, apellidos, fecha_nacimiento, alergias')
        .neq('activo', false)
        .or(`nombre.ilike.%${busquedaNorm}%,apellidos.ilike.%${busquedaNorm}%`)
        .limit(8)

      if (!error) {
        setResultados(data ?? [])
      }
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  function seleccionar(p: Paciente) {
    setPacienteSeleccionado(p)
    setBusqueda('')
    setResultados([])
  }

  function limpiarPaciente() {
    setPacienteSeleccionado(null)
    setTipo(null)
  }

  const sinResultados = busqueda.length >= 2 && !buscando && resultados.length === 0

  return (
    /* Columna de 640 centrada en el área de contenido (CALMA §14); en `iv`,
       la de 600 (§19). */
    <div lang="es" className={`mx-auto w-full max-w-[640px] iv:max-w-[600px] animate-slide-up${tipo === 'escrito' ? ' esc:max-w-[880px]' : ''}`}>

      {/* Header */}
      <header className="mb-6">
        <p className="text-[12px] font-bold uppercase leading-4 tracking-[.4px] text-enlace">Clínica</p>
        <h1 className="k-t-pantalla mt-1">Documentos</h1>
        <p className="k-t-sec mt-1">Genera e imprime documentos con tu membrete oficial</p>
      </header>

      {/* Paso 1 — Seleccionar paciente */}
      {!pacienteSeleccionado ? (
        <section aria-labelledby="doc-paso1">
          <p className="text-[12px] font-bold uppercase leading-4 tracking-[.4px] text-enlace">Paso 1</p>
          <h2 id="doc-paso1" className="k-t-tarjeta mt-1 mb-3">Selecciona el paciente</h2>

          <div className="relative">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta2" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o apellido..."
              aria-label="Buscar por nombre o apellido"
              className="k-campo pl-11"
              autoFocus
            />
          </div>
          <p className="k-campo-ayuda mt-2">El documento se guardará en su expediente automáticamente.</p>

          {resultados.length > 0 && (
            <ul className="k-tarjeta k-lista mt-3">
              {resultados.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => seleccionar(p)} className="k-fila">
                    <Avatar texto={inicialesDe(p.nombre, p.apellidos)} indice={i} />
                    <span className="k-fila-t"><span className="k-fila-n font-normal">{p.nombre} {p.apellidos}</span></span>
                    <ChevronRight aria-hidden="true" className="k-fila-chev" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {buscando && (
            <p role="status" className="k-t-sec mt-3 flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Buscando...
            </p>
          )}

          {sinResultados && (
            <div className="k-tarjeta k-lista mt-3">
              <button type="button" onClick={() => setShowQuickPatient(true)} className="k-fila" aria-label={`Registrar paciente: ${busqueda}`}>
                <span className="k-fila-t">
                  <span className="k-fila-n">Registrar &quot;{busqueda}&quot;</span>
                  <span className="k-fila-s">Crear nuevo paciente y continuar</span>
                </span>
                <ChevronRight aria-hidden="true" className="k-fila-chev" />
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Paciente seleccionado */}
          <div className="k-tarjeta mb-6 flex items-center gap-3 !py-2.5">
            <Avatar texto={inicialesDe(pacienteSeleccionado.nombre, pacienteSeleccionado.apellidos)} />
            <div className="min-w-0 flex-1">
              <p className="k-t-fila truncate">
                {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellidos}
              </p>
              <p className="k-t-sec">Paciente seleccionado</p>
              {/* La alergia en la cabecera de la receta (CALMA §23.4); sin
                  alergias registradas no se dibuja nada. */}
              {tipo === 'receta' && pacienteSeleccionado.alergias?.trim() && (
                <span className="k-etq k-etq-mal mt-1.5 h-auto min-h-6 max-w-full whitespace-normal py-0.5">
                  <AlertTriangle aria-hidden="true" />
                  Alergias: {pacienteSeleccionado.alergias.trim()}
                </span>
              )}
            </div>
            <button type="button" onClick={limpiarPaciente} aria-label="Cambiar de paciente" className="k-b k-b-icono -mr-2">
              <X aria-hidden="true" />
            </button>
          </div>

          {/* Paso 2 — Selector de tipo + formulario.
              Las tarjetas del sistema sustituyen a la rejilla con sublabels:
              los sublabels se caen porque la etiqueta completa ya nombra el
              documento, y con ellos se caen los cuatro colores que divergían
              de los ocho tokens (teal en escrito, amber-600 en suplementación,
              slate en honorarios). */}
          {/* «Paso 2 · Tipo de documento», en rótulo y título como el Paso 1.
              FUERA de `.sp-doc-host`: la cabecera del formulario (el tipo y
              «Cambiar») tiene que ser lo primero del anfitrión, porque el «···»
              del formulario se alinea con ella (`spinus-tokens.css` §26). */}
          <div className="mb-2.5">
            <p className="text-[12px] font-bold uppercase leading-4 tracking-[.4px] text-enlace">Paso 2</p>
            <h2 className="k-t-tarjeta mt-1">Tipo de documento</h2>
          </div>
          <div className="sp-doc-host">
            <SelectorTipoDocumento
              value={tipo}
              onChange={t => { setFormVacio(true); setPanelPlantillas(false); setTipo(t) }}
              conDatos={!formVacio}
              oculto={panelPlantillas}
            >
              {/* ⚠️ DESELECCIONAR EL TIPO DESMONTA EL FORMULARIO, Y ESO NO ES UN
                  EFECTO SECUNDARIO: ES LA GARANTÍA. Es lo único que impide editar un
                  documento ya emitido —entre emitir y desmontar el modal tapa el
                  formulario y atrapa el foco—, así que cuando vuelve a existir es
                  uno nuevo y vacío. Los formularios tuvieron una segunda red por
                  dentro (una huella del contenido al emitir) y se retiró por
                  inalcanzable; si esto deja de desmontar, hay que reponerla. */}
              {tipo === 'receta' && (
                <RecetaForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
              {tipo === 'lab' && <SolicitudLabForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)} onPanelPlantillasChange={setPanelPlantillas} />}
              {tipo === 'imagen' && <SolicitudImagenForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)} onPanelPlantillasChange={setPanelPlantillas} />}
              {tipo === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)} onPanelPlantillasChange={setPanelPlantillas} />}
              {tipo === 'internamiento' && (
                <SolicitudInternamientoForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
              {tipo === 'escrito' && (
                <EscritoMedicoForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
              {tipo === 'consentimiento' && (
                <ConsentimientoForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  edadInicial={pacienteSeleccionado.fecha_nacimiento
                    ? calcularEdad(pacienteSeleccionado.fecha_nacimiento).textoElegante
                    : ''}
                  fechaNacimiento={pacienteSeleccionado.fecha_nacimiento ?? null}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
              {tipo === 'honorarios' && (
                <NotaHonorariosForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setTipo(null)}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
            </SelectorTipoDocumento>
          </div>
        </>
      )}

      {/* Modal registro rápido — mismo que en Agenda */}
      {showQuickPatient && (
        <QuickPatientModal
          nombreInicial={busqueda}
          onCreated={p => {
            seleccionar(p)
            setShowQuickPatient(false)
          }}
          onClose={() => setShowQuickPatient(false)}
        />
      )}

    </div>
  )
}

export default function DocumentosPage() {
  return (
    <Suspense>
      <DocumentosContent />
    </Suspense>
  )
}
