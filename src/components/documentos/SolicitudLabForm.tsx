'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'

import { useEffect, useRef, useState } from 'react'

import { Plus, Trash2, Printer, AlertTriangle, FlaskConical } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import ComboEscribible from '@/components/documentos/ComboEscribible'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { ESTUDIOS_LAB } from '@/lib/estudiosLab'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'

/**
 * Diez cadenas fijas, sin identificador ni versión: la comparación con la lista
 * es de texto exacto. Si una cambia, las plantillas guardadas dejan de encender
 * ese chip pero el estudio sigue en la lista — ni el panel ni el formulario
 * pueden asumir que un estudio guardado tiene chip. Consecuencia declarada.
 */
const ESTUDIOS_PRESET = [
  'Biometría Hemática',
  'Glucosa',
  'Urea',
  'Creatinina',
  'Examen General de Orina',
  'TP',
  'TPT',
  'Perfil Tiroideo Completo',
  'Urocultivo',
  'Cultivo de Secreción',
] as const

const FECHA_MIN = '1900-01-01'

/**
 * Predicado único de «formulario vacío». Mismo criterio que Honorarios: los
 * campos que llegan prellenados de la ficha NO cuentan como escritos hasta que
 * se editan, porque llegaron solos.
 */
function isFormEmpty(
  estudios: string[], notas: string,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  return pacienteIntacto && dxIntacto && notas.trim() === '' && estudios.every(e => e.trim() === '')
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

export default function SolicitudLabForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onPanelPlantillasChange }: Props) {
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
  const [estudios, setEstudios] = useState<string[]>([''])
  const [notas, setNotas] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  const vacio = isFormEmpty(estudios, notas, paciente, pacienteInicial, diagnostico, diagnosticoInicial)
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente. Aquí eso deja fuera paciente,
  // diagnóstico y fecha: los tres son suyos aunque los teclee el médico, y una
  // plantilla con la fecha congelada es un defecto.
  const plantillas = usePlantillasDocumento({
    tipo: 'solicitud_lab',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, estudios: estudios.filter(e => e.trim() !== ''), notas }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, y comprobando el tipo
      // de cada una: el jsonb pudo guardarse con otra versión del formulario.
      // Los dos `else` NO son defensa de sobra: «Vaciar formulario» aplica un
      // contenido sin ninguna clave, así que es justo lo que repone el estado
      // inicial. El paciente y el diagnóstico no se tocan aquí, y por eso
      // sobreviven al vaciado.
      const guardados = Array.isArray(c.estudios)
        ? c.estudios.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
        : []
      setEstudios(guardados.length > 0 ? guardados : [''])
      setNotas(typeof c.notas === 'string' ? c.notas : '')
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  function addEstudio() { setEstudios([...estudios, '']) }
  function removeEstudio(i: number) { setEstudios(estudios.filter((_, idx) => idx !== i)) }
  function updateEstudio(i: number, val: string) { setEstudios(estudios.map((e, idx) => idx === i ? val : e)) }

  // L-01: una sola fuente de verdad. El chip no guarda estado — lo inserta o lo
  // retira de `estudios`, y su encendido se deriva de ahí. Dos arrays divergen
  // siempre.
  function togglePreset(preset: string) {
    if (estudios.includes(preset)) setEstudios(estudios.filter(e => e !== preset))
    else setEstudios([...estudios.filter(e => e.trim() !== ''), preset])
  }

  // ── Validación (§3.8) ───────────────────────────────────────────
  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'paciente', nombre: 'Paciente' })
  if (estudios.every(e => e.trim() === '')) faltantes.push({ clave: 'estudios', nombre: 'Estudios' })

  function textoFaltantes(): string {
    const n = faltantes.length
    const cabeza = faltantes.slice(0, 3).map(f => f.nombre).join(' · ')
    const resto = n > 3 ? ` y ${n - 3} más` : ''
    return `${n === 1 ? 'Falta 1 campo' : `Faltan ${n} campos`}: ${cabeza}${resto}`
  }

  function irA(clave: string) {
    if (clave === 'paciente') { enfocarYAcercar(pacienteRef.current); return }
    enfocarYAcercar(formRef.current?.querySelector<HTMLElement>('#laboratorio-estudio-0') ?? null)
  }

  async function imprimir() {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de laboratorio...')

    // 2. Identidad — UUID v4 puro como clientId (las solicitudes de lab
    //    no tienen folio público ni verificación externa, no necesitan
    //    un identificador visible en el PDF)
    const clientId = crypto.randomUUID()
    const contenido = {
      paciente,
      diagnostico,
      estudios: estudios.filter(Boolean),
      notas,
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
      //    DESPUÉS de escribir y renderizar antes imprimía un papel sin él: un
      //    número que no está en el papel no sirve para que nadie te cite el
      //    documento por teléfono. Es el orden que ya seguían el consentimiento
      //    y la denegación (`20260812_documentos_estado.sql`, trampa 2).
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT y la
      //    fila quedaría emitida con folio nulo para siempre.
      //
      //    Precio de la inversión, aceptado: si el render falla, la fila ya
      //    existe y el folio ya se consumió. No queda huérfana —aparece en la
      //    lista con su botón de regenerar— y el mensaje de error lo dice con el
      //    folio delante.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'solicitud_lab',
          contenido,
          client_id: clientId,
          subido_por: user.id,
          // CON QUÉ CHASIS SALE EL PAPEL. La fila nace emitida, así que la
          // versión se fija aquí y a partir de este INSERT es inmutable
          // (`20260813_formato_version_inmutable.sql`). Tiene que ser el mismo
          // número que recibe `generarPdf` más abajo.
          formato_version: VERSION_DE_EMISION,
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
        // El membrete de v2 la exige por normativa (I.3.7) y sin ella el
        // renglón sale sin universidad, en silencio.
        universidad: medicoInfo.universidad ?? null,
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
        tipo: 'solicitud_lab',
        pacienteId,
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          estudios: estudios.filter(Boolean),
          notas: notas || undefined,
          // En el búnker offline no hay fila ni base, así que llega undefined y
          // el papel sale sin número, igual que hasta ahora.
          folio: folioImpreso('solicitud_lab', folio),
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Solicitud_Laboratorio'),
        consultorio: consultorioData,
        // El mismo número que acaba de escribirse en la fila. Ver `versionQueEmite`.
        formatoVersion: versionQueEmite(offlineMode),
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
          tipo: 'solicitud_lab',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Solicitud de laboratorio guardada en bunker offline')
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
          if (error) console.error('[SolicitudLabForm] update pdf_url:', error.message)
        }
        toast.success(folio
          ? `Solicitud de laboratorio guardada · ${folio}`
          : 'Solicitud de laboratorio guardada')
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
      console.error('[SolicitudLabForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)
  const conNumeral = estudios.length >= 2

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
              <label htmlFor="laboratorio-fecha" className="sp-label-field">Fecha</label>
              <input id="laboratorio-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="laboratorio-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="laboratorio-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('paciente') || undefined}
                className={`sp-input ${senalar('paciente') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="laboratorio-diagnostico" className="sp-label-field">Diagnóstico</label>
              <input id="laboratorio-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Dx de envío" className="sp-input" />
            </div>
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Estudios frecuentes</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-chips">
            {ESTUDIOS_PRESET.map(preset => (
              <button key={preset} type="button" onClick={() => togglePreset(preset)}
                aria-pressed={estudios.includes(preset)} className="sp-chip">
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><FlaskConical /></div>
          <h2 className="sp-label">Estudios solicitados</h2>
          <button type="button" onClick={addEstudio} aria-label="Agregar"
            className="sp-btn sp-btn--compact sp-doc-add">
            <Plus size={17} /><span className="sp-doc-long">Agregar</span>
          </button>
        </div>
        <div className="sp-doc-cardbody">
          {estudios.length === 0 ? (
            <div className="sp-doc-empty">
              <div className="sp-icobox sp-icobox--sm"><FlaskConical /></div>
              <p className="sp-hint">Sin estudios. Usa «Agregar».</p>
            </div>
          ) : (
            <div className={estudios.length >= 4 ? 'sp-doc-list--long' : undefined}>
              {estudios.map((estudio, i) => (
                <div key={i} className="sp-doc-listrow">
                  {conNumeral && <span className="sp-label sp-doc-listnum">{i + 1}.</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ComboEscribible
                      id={`laboratorio-estudio-${i}`}
                      value={estudio}
                      onChange={val => updateEstudio(i, val)}
                      sugerencias={ESTUDIOS_LAB}
                      minCaracteres={2}
                      placeholder="Nombre del estudio"
                      pie="Ninguno encaja: escribe el nombre y se usa tal cual."
                      invalido={senalar('estudios')}
                      claseExtra={senalar('estudios') ? 'sp-doc-invalid' : ''}
                    />
                  </div>
                  <button type="button" onClick={() => removeEstudio(i)} disabled={estudios.length === 1}
                    aria-label={estudio.trim() ? `Eliminar ${estudio.trim()}` : `Eliminar estudio ${i + 1}`}
                    className="sp-doc-iconbtn">
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Indicaciones / Notas</h2>
        </div>
        <div className="sp-doc-cardbody">
          <label htmlFor="laboratorio-notas" className="sr-only">Indicaciones / Notas</label>
          <textarea id="laboratorio-notas" value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Indicaciones especiales, ayuno requerido…" className="sp-textarea" />
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

      {intentado && faltantes.length > 0 && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>
            {textoFaltantes().split(':')[0]}:{' '}
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
                <span className="sp-doc-long">Imprimir solicitud de laboratorio</span>
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
        titulo="Solicitud de laboratorio generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}
