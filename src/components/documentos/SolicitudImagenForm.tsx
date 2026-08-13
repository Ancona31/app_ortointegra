'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useEffect, useRef, useState } from 'react'

import { Printer, Trash2, Plus, Check, AlertTriangle, ScanLine } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import ComboEscribible from '@/components/documentos/ComboEscribible'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'

const TIPOS_ESTUDIO = [
  'Radiografía',
  // Las dos variantes de RMN por separado: es lo que cambia la preparación del
  // paciente y el coste del estudio, así que el radiólogo necesita saber cuál
  // desde la solicitud. Quien tenga otro caso lo escribe — el campo es libre y
  // esto es solo la lista de sugerencias.
  'Resonancia magnética simple',
  'Resonancia magnética contrastada',
  'Tomografía (TAC)',
  'Ultrasonido',
  'Densitometría ósea',
  'Gammagrafía',
  'Electromiografía (EMG)',
  'Mielograma',
] as const

const FECHA_MIN = '1900-01-01'

type Estudio = { tipo: string; region: string; proyecciones?: string; indicacion?: string }

const ESTUDIO_VACIO: Estudio = { tipo: '', region: '', proyecciones: '', indicacion: '' }

/**
 * El par tipo + región se exige JUNTO, no campo a campo.
 * Un estudio a medias no es una petición — y hasta ahora se caía del PDF sin
 * decirlo, porque el payload filtraba por `e.tipo && e.region`.
 */
type EstadoEstudio = 'vacio' | 'completo' | 'faltaRegion' | 'faltaTipo'

function estadoDe(e: Estudio): EstadoEstudio {
  const tipo = e.tipo.trim()
  const region = e.region.trim()
  if (!tipo && !region) return 'vacio'      // se ignora: ni molesta ni bloquea
  if (tipo && region) return 'completo'
  return tipo ? 'faltaRegion' : 'faltaTipo'
}

/** Alguno de los cuatro campos tiene texto. Gobierna qué filas van a plantilla. */
function conTexto(e: Estudio): boolean {
  return !!(e.tipo.trim() || e.region.trim() || e.proyecciones?.trim() || e.indicacion?.trim())
}

/**
 * Lee una fila guardada en jsonb, campo a campo y desconfiando de todo: el
 * contenido pudo escribirse con otra versión del formulario.
 */
function leerEstudio(bruto: unknown): Estudio | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const e: Estudio = {
    tipo: texto(fila.tipo),
    region: texto(fila.region),
    proyecciones: texto(fila.proyecciones),
    indicacion: texto(fila.indicacion),
  }
  return conTexto(e) ? e : null
}

/** Predicado único de «formulario vacío». Mismo criterio que Honorarios. */
function isFormEmpty(
  estudios: Estudio[], urgente: boolean,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  const sinEstudios = estudios.every(e =>
    !e.tipo.trim() && !e.region.trim() && !e.proyecciones?.trim() && !e.indicacion?.trim())
  return pacienteIntacto && dxIntacto && !urgente && sinEstudios
}

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
  /** Reporta al host si el formulario sigue vacío (guía 04 §6.1 y §6.2). */
  onVacioChange?: (vacio: boolean) => void
  /**
   * El panel de plantillas sustituye al formulario en su mismo espacio, y
   * mientras está abierto el selector de tipo del host se oculta (spec 02 §3.1):
   * elegir otro tipo desde ahí tiraría el formulario sobre el que el panel
   * opera.
   */
  onPanelPlantillasChange?: (abierto: boolean) => void
}

export default function SolicitudImagenForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onPanelPlantillasChange }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // In offline mode, read doctor profile from localStorage (pre-fetched with Base64 assets)
  const offlineProfile = offlineMode ? (() => {
    try {
      const raw = localStorage.getItem('spinus_doctor_profile')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })() : null

  const medicoInfo = offlineMode && offlineProfile ? {
    ...onlineMedicoInfo,
    nombre: offlineProfile.nombre,
    especialidad: offlineProfile.especialidad,
    cedula_profesional: offlineProfile.cedula_profesional,
    cedula_especialidad: offlineProfile.cedula_especialidad,
    universidad: offlineProfile.universidad,
    direccion_consultorio: offlineProfile.direccion_consultorio,
    telefono_consultorio: offlineProfile.telefono_consultorio,
    color_primario: offlineProfile.color_primario,
    color_secundario: offlineProfile.color_secundario,
    logo_url: offlineProfile.logo_base64,
    firma_url: offlineProfile.firma_base64,
    clinica_nombre: offlineProfile.clinica_nombre,
  } : onlineMedicoInfo

  // Imprimir antes de que resuelva el perfil produce un PDF con el encabezado
  // vacío: sin nombre, sin cédulas, sin domicilio. Solo bloquea mientras carga;
  // si resuelve sin datos el botón se habilita igual.
  const perfilPendiente = cargandoPerfil && !medicoInfo
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(hoyEnTZ())
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<Estudio[]>([{ ...ESTUDIO_VACIO }])
  const [urgente, setUrgente] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)
  // Nada acusa antes del primer intento de imprimir; después todo se actualiza
  // en vivo. Gobierna el banner (§3.8) Y el teñido del bloque a medias (§2.4):
  // sin esto, el bloque se pone rojo mientras se teclea el tipo y antes de que
  // dé tiempo a llegar a la región.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  const vacio = isFormEmpty(estudios, urgente, paciente, pacienteInicial, diagnostico, diagnosticoInicial)
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente: fuera paciente, diagnóstico y
  // fecha. Los estudios se guardan aunque estén a medias —una plantilla es un
  // punto de partida, no un documento— y el filtro del par tipo+región sigue
  // gobernando la emisión, no el guardado.
  const plantillas = usePlantillasDocumento({
    tipo: 'solicitud_imagen',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, estudios: estudios.filter(conTexto), urgente }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, campo a campo.
      // Los dos valores de repuesto NO son defensa de sobra: «Vaciar
      // formulario» aplica un contenido sin ninguna clave, así que es justo lo
      // que repone el estado inicial. El paciente y el diagnóstico no se tocan
      // aquí, y por eso sobreviven al vaciado.
      const guardados = Array.isArray(c.estudios)
        ? c.estudios.map(leerEstudio).filter((e): e is Estudio => e !== null)
        : []
      setEstudios(guardados.length > 0 ? guardados : [{ ...ESTUDIO_VACIO }])
      setUrgente(c.urgente === true)
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]):not([type="checkbox"])')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  function addEstudio() { setEstudios([...estudios, { ...ESTUDIO_VACIO }]) }
  function removeEstudio(i: number) { setEstudios(estudios.filter((_, idx) => idx !== i)) }
  function updateEstudio(i: number, campo: keyof Estudio, val: string) {
    setEstudios(estudios.map((e, idx) => idx === i ? { ...e, [campo]: val } : e))
  }

  // ── Validación ──────────────────────────────────────────────────
  const estados = estudios.map(estadoDe)
  const primerIncompleto = estados.findIndex(s => s === 'faltaRegion' || s === 'faltaTipo')
  const completos = estudios.filter((_, i) => estados[i] === 'completo')

  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'paciente', nombre: 'Paciente' })
  if (completos.length === 0) faltantes.push({ clave: 'estudios', nombre: 'un estudio con tipo y región' })

  function irA(clave: string) {
    if (clave === 'paciente') { enfocarYAcercar(pacienteRef.current); return }
    enfocarYAcercar(formRef.current?.querySelector<HTMLElement>('#imagen-tipo-0') ?? null)
  }

  async function imprimir() {
    // Dos puertas. La del par va primero: es la que evita que un estudio a
    // medias desaparezca del PDF sin avisar.
    if (primerIncompleto >= 0) {
      setIntentado(true)
      enfocarYAcercar(formRef.current?.querySelector<HTMLElement>(
        estados[primerIncompleto] === 'faltaRegion'
          ? `#imagen-region-${primerIncompleto}`
          : `#imagen-tipo-${primerIncompleto}`,
      ) ?? null)
      return
    }
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de imagenología...')

    // 2. Identidad — UUID v4 puro (las solicitudes de imagen no tienen
    //    verificación pública ni folio visible)
    const clientId = crypto.randomUUID()
    // El filtro sobrevive, pero ya no descarta nada en silencio: emitir con un
    // estudio a medias es imposible, y los del todo vacíos se ignoran a
    // propósito (§2.4).
    const contenido = {
      paciente,
      diagnostico,
      estudios: completos,
      urgente,
      fecha,
    }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folio: string | null = null

    try {
      // ── 3 · LA FILA PRIMERO, porque de ella sale el folio ─────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—. El
      //    trigger asigna el folio en el INSERT, así que el número solo existe
      //    DESPUÉS de escribir y renderizar antes imprimía un papel sin él. Es
      //    el orden que ya seguían el consentimiento y la denegación
      //    (`20260812_documentos_estado.sql`, trampa 2).
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT y la
      //    fila quedaría emitida con folio nulo para siempre.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'solicitud_imagen',
          contenido,
          client_id: clientId,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { data, error } = await supabase
          .from('documentos')
          .insert(insertPayload)
          .select('id, folio')
          .single()
        if (error) throw error
        filaId = data.id
        folio = data.folio
        // La fila está en el expediente. Aunque el PDF falle después, el
        // documento es recuperable desde la lista con su botón de regenerar.
        guardado = true
      }

      // ── 4 · El PDF, ya con el número que la base acaba de asignar ─────
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
        titulo: medicoInfo.titulo ?? null,
        nombres: medicoInfo.nombres ?? null,
        apellido_paterno: medicoInfo.apellido_paterno ?? null,
        apellido_materno: medicoInfo.apellido_materno ?? null,
        especialidad: medicoInfo.especialidad,
        cedula_profesional: medicoInfo.cedula_profesional,
        cedula_especialidad: medicoInfo.cedula_especialidad,
        color_primario: medicoInfo.color_primario,
        color_secundario: medicoInfo.color_secundario,
        direccion_consultorio: medicoInfo.direccion_consultorio,
        telefono_consultorio: medicoInfo.telefono_consultorio,
        firma_url: medicoInfo.firma_url ?? null,
      } : null

      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'solicitud_imagen',
        pacienteId,
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          estudios: completos,
          urgente,
          // En el búnker offline no hay fila ni base, así que llega undefined y
          // el papel sale sin número, igual que hasta ahora.
          folio: folioImpreso('solicitud_imagen', folio),
        },
        logoUrl,
        // IMAGENOLOGÍA Y NO IMAGEN, también en el nombre del archivo: el título
        // del documento cambió en las tres capas a la vez —el PDF, la pantalla y
        // el archivo que se descarga— para que quien busque el papel en su
        // carpeta lo encuentre por el mismo nombre con que lo pidió. Ver
        // `DOCUMENTOS_HANDOFF.md` §8, cambio 4.
        filename: generateDocFileName(paciente, 'Solicitud_Imagenologia'),
        consultorio: consultorioData,
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfBlob = blob

      // ── 5 · La ruta del archivo, sobre la fila que ya existe ──────────
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'solicitud_imagen',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Solicitud de imagenología guardada en bunker offline')
        onOfflineSave?.()
      } else {
        if (storagePath && filaId && supabase) {
          // Este UPDATE no toca ni el estado ni el folio, así que el trigger lo
          // deja pasar. No es fatal si falla: la fila está y el PDF se entrega
          // igual; lo que se pierde es la descarga desde la lista, que el botón
          // de regenerar repone.
          const { error } = await supabase
            .from('documentos')
            .update({ pdf_url: storagePath })
            .eq('id', filaId)
          if (error) console.error('[SolicitudImagenForm] update pdf_url:', error.message)
        }
        toast.success(folio
          ? `Solicitud de imagenología guardada · ${folio}`
          : 'Solicitud de imagenología guardada')
      }
    } catch (err) {
      // Tres desenlaces, y el del medio es nuevo: con la fila escrita antes que
      // el PDF, un fallo de render deja un documento emitido y un folio
      // consumido. Decirlo con el número delante es lo que permite encontrarlo
      // en la lista y recuperar el PDF desde ahí.
      let msg: string
      if (offlineMode) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar la solicitud, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `La solicitud quedó registrada${folio ? ` con folio ${folio}` : ''}, pero no se pudo `
          + 'generar el PDF. Búscala en la lista de documentos del paciente y recupérala desde ahí.'
      }
      toast.error(msg)
      setErrorGuardado(msg)
      // eslint-disable-next-line no-console
      console.error('[SolicitudImagenForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Datos del paciente</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid" data-cols="3">
            <div className="sp-doc-field">
              <label htmlFor="imagen-fecha" className="sp-label-field">Fecha</label>
              <input id="imagen-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="imagen-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="imagen-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('paciente') || undefined}
                className={`sp-input ${senalar('paciente') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="imagen-diagnostico" className="sp-label-field">Diagnóstico</label>
              <input id="imagen-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Dx de envío" className="sp-input" />
            </div>

            {/* El rojo se reserva al badge, que además es el que sale en el PDF:
                la etiqueta entera en rojo competía con los errores de campo. */}
            <div className="sp-doc-span-all">
              <label className="sp-check">
                <input type="checkbox" checked={urgente}
                  onChange={e => setUrgente(e.target.checked)} className="sr-only" />
                <span className="sp-check__box"><Check aria-hidden="true" /></span>
                <span className="sp-check__label">Marcar como urgente</span>
                {urgente && <span className="sp-badge sp-badge--danger">URGENTE</span>}
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><ScanLine /></div>
          <h2 className="sp-label">Estudios de imagen</h2>
          <button type="button" onClick={addEstudio} aria-label="Agregar estudio"
            className="sp-btn sp-btn--compact sp-doc-add">
            <Plus size={17} /><span className="sp-doc-long">Agregar estudio</span>
          </button>
        </div>
        <div className="sp-doc-cardbody">
          {estudios.map((e, i) => {
            const estado = estados[i]
            const roto = intentado && (estado === 'faltaRegion' || estado === 'faltaTipo')
            return (
              <div key={i} className={`sp-doc-studyblock ${roto ? 'sp-doc-studyblock--invalid' : ''}`}>
                <div className="sp-doc-studyhead">
                  <span className="sp-label" style={{ fontSize: '11.5px', fontWeight: 'var(--sp-fw-black)' }}>
                    Estudio {i + 1}
                  </span>
                  {e.region.trim() && (
                    <span className="sp-chip sp-chip--meta sp-doc-studychip">{e.region.trim()}</span>
                  )}
                  <button type="button" onClick={() => removeEstudio(i)} disabled={estudios.length === 1}
                    aria-label={`Eliminar estudio ${i + 1}`}
                    className="sp-doc-iconbtn" style={{ marginLeft: 'auto' }}>
                    <Trash2 />
                  </button>
                </div>

                <div className="sp-doc-studygrid">
                  <div className="sp-doc-field" data-span="2">
                    <label htmlFor={`imagen-tipo-${i}`} className="sp-label-field">
                      Tipo de estudio <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                      <span className="sr-only">obligatorio</span>
                    </label>
                    <ComboEscribible
                      id={`imagen-tipo-${i}`}
                      value={e.tipo}
                      onChange={val => updateEstudio(i, 'tipo', val)}
                      sugerencias={TIPOS_ESTUDIO}
                      placeholder="Seleccionar o escribir…"
                      pie="Ninguno encaja: escribe el tipo y se usa tal cual."
                      invalido={roto && estado === 'faltaTipo'}
                      claseExtra={roto && estado === 'faltaTipo' ? 'sp-doc-invalid--pair' : ''}
                    />
                    {roto && estado === 'faltaTipo' && (
                      <p className="sp-hint" style={{ color: 'var(--sp-danger)' }}>
                        Falta el tipo. Complétalo o borra el estudio.
                      </p>
                    )}
                  </div>

                  <div className="sp-doc-field" data-span="2">
                    <label htmlFor={`imagen-region-${i}`} className="sp-label-field">
                      Región anatómica <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                      <span className="sr-only">obligatorio</span>
                    </label>
                    {/* Campo libre y sin sugerencias: lado, nivel y segmento son
                        lo que más varía y una lista estorbaría más que ayudaría. */}
                    <input id={`imagen-region-${i}`} type="text" value={e.region}
                      onChange={ev => updateEstudio(i, 'region', ev.target.value)}
                      placeholder="Ej: Columna lumbar, rodilla der."
                      aria-invalid={(roto && estado === 'faltaRegion') || undefined}
                      className={`sp-input ${roto && estado === 'faltaRegion' ? 'sp-doc-invalid--pair' : ''}`} />
                    {roto && estado === 'faltaRegion' && (
                      <p className="sp-hint" style={{ color: 'var(--sp-danger)' }}>
                        Falta la región. Complétala o borra el estudio.
                      </p>
                    )}
                  </div>

                  {/* Siempre visibles: son una línea cada una y son lo que evita
                      la llamada del radiólogo. Plegarlas cuesta un toque por
                      estudio y ahorra 74px. */}
                  <div className="sp-doc-field" data-span="1">
                    <label htmlFor={`imagen-proyecciones-${i}`} className="sp-label-field">Proyecciones</label>
                    <input id={`imagen-proyecciones-${i}`} type="text" value={e.proyecciones ?? ''}
                      onChange={ev => updateEstudio(i, 'proyecciones', ev.target.value)}
                      placeholder="AP, lateral…" className="sp-input" />
                  </div>

                  <div className="sp-doc-field" data-span="3">
                    <label htmlFor={`imagen-indicacion-${i}`} className="sp-label-field">Indicación clínica específica</label>
                    <input id={`imagen-indicacion-${i}`} type="text" value={e.indicacion ?? ''}
                      onChange={ev => updateEstudio(i, 'indicacion', ev.target.value)}
                      placeholder="Ej: Descartar fractura vertebral" className="sp-input" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {errorGuardado && <p className="sp-banner sp-banner--danger">{errorGuardado}</p>}

      {!cargandoPerfil && !medicoInfo && (
        <p className="sp-banner sp-banner--warn">
          <AlertTriangle size={17} />
          <span style={{ flex: 1 }}>Completa tu perfil para que el documento salga con tu encabezado.</span>
          <Link href="/perfil" className="sp-link-alt">Ir a mi perfil</Link>
        </p>
      )}

      {/* Nombra el ESTUDIO, no el campo: con dos o tres bloques en pantalla,
          «falta la región» no localiza nada. */}
      {intentado && primerIncompleto >= 0 && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>
            El estudio {primerIncompleto + 1} tiene{' '}
            {estados[primerIncompleto] === 'faltaRegion' ? 'tipo sin región' : 'región sin tipo'}:
            {' '}complétalo o bórralo.
          </span>
        </p>
      )}

      {intentado && primerIncompleto < 0 && faltantes.length > 0 && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>
            {faltantes.length === 1 ? 'Falta 1 campo' : `Faltan ${faltantes.length} campos`}:{' '}
            {faltantes.slice(0, 3).map((f, i) => (
              <span key={f.clave}>
                {i > 0 && ' · '}
                <button type="button" onClick={() => irA(f.clave)}
                  className="sp-link-alt" style={{ color: 'var(--sp-warn-strong)' }}>
                  {f.nombre}
                </button>
              </span>
            ))}
            {faltantes.length > 3 && ` y ${faltantes.length - 3} más`}
          </span>
        </p>
      )}

      {/* «Guardar como plantilla» va aquí y no arriba: se guarda cuando el
          formulario YA está lleno, así que su sitio es junto al de imprimir. */}
      <div className="sp-doc-actions">
        {plantillas.botonGuardar}
        <button type="button" onClick={imprimir} disabled={imprimiendo || perfilPendiente}
          className="sp-btn sp-btn--primary">
          {imprimiendo ? <><span className="sp-spinner" /> Generando PDF…</>
            : perfilPendiente ? <><span className="sp-spinner" /> Cargando tu perfil…</>
            : <>
                <Printer size={17} />
                <span className="sp-doc-long">Imprimir solicitud de imagenología</span>
                <span className="sp-doc-short">Imprimir</span>
              </>}
        </button>
      </div>

      </div>

      {plantillas.panel}
      {plantillas.dialogos}

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        onClose={() => setDocGenerado(null)}
        blob={docGenerado?.blob ?? null}
        titulo="Solicitud de imagenología generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}
