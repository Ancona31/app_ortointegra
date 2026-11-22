'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta, MedicoInfo } from '@/types'
import { parseISO, format } from 'date-fns'
import { generateDocFileName } from '@/lib/patientUtils'
import { es } from 'date-fns/locale'
import { ChevronLeft, Printer, Plus, Loader2, Lock, PenLine, Sparkles, Eye } from 'lucide-react'
import Link from 'next/link'
import { useAuditAccess } from '@/hooks/useAudit'
import { buildNotaRenderData } from '@/lib/notaRenderData'
import CuerpoNota from '@/components/expediente/CuerpoNota'
import { generarPdf } from '@/lib/mobileShare'

type Addendum = {
  id: string
  contenido: string
  medico_nombre: string
  created_at: string
}

export default function ConsultaDetallePage() {
  const { id, consultaId } = useParams<{ id: string; consultaId: string }>()
  useAuditAccess('consultas', consultaId)

  // ── Data fetching: direct Supabase queries ──
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    Promise.all([
      supabase.from('pacientes').select('*').eq('id', id).single(),
      supabase.from('consultas').select('*').eq('id', consultaId).single(),
    ]).then(([pacRes, conRes]) => {
      if (cancelled) return
      if (!pacRes.error && pacRes.data) setPaciente(pacRes.data as Paciente)
      if (!conRes.error && conRes.data) setConsulta(conRes.data as Consulta)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [id, consultaId])

  // ── Datos complementarios ──
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [addendums, setAddendums] = useState<Addendum[]>([])

  // Addendum form
  const [showAddendum, setShowAddendum] = useState(false)
  const [addendumTexto, setAddendumTexto] = useState('')
  const [guardandoAddendum, setGuardandoAddendum] = useState(false)
  const [error, setError] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  /**
   * El botón no abre el PDF: se convierte en el enlace que lo abre.
   *
   * `generarPdf` lo abría él mismo al terminar, después del refresco del perfil
   * médico, el fetch del logo, los imports dinámicos y el render. Para entonces
   * la activación transitoria del gesto ya estaba consumida y Safari bloqueaba
   * la apertura — en silencio en iOS y en la PWA. En una nota duele más que en
   * un documento: la reimpresión no se persiste, así que si no se abre no queda
   * en ninguna lista donde ir a buscarla.
   *
   * Con el href ya resuelto, entre el toque y la navegación no hay asincronía.
   * Mismo criterio que ModalDocumentoGenerado, duplicado a propósito.
   */
  const pdfUrl = useMemo(() => (pdfBlob ? URL.createObjectURL(pdfBlob) : null), [pdfBlob])

  useEffect(() => {
    if (!pdfUrl) return
    return () => {
      // 60s de gracia: si el médico ya lo abrió, el visor tiene su copia
      // interna y revocar es seguro.
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    }
  }, [pdfUrl])

  useEffect(() => {
    // Perfil médico — best-effort
    fetch('/api/me/perfil-medico')
      .then(r => r.json())
      .then(({ medico }) => setMedicoInfo(medico))
      .catch(() => {})

    // Addendums
    fetch(`/api/consultas/${consultaId}/addendum`)
      .then(r => r.json())
      .then(data => setAddendums(data.addendums ?? []))
      .catch(() => {})
  }, [consultaId])

  /* ⚠️ UNA SOLA FUENTE PARA LA PANTALLA Y PARA EL PDF. Antes esto se armaba
     dentro de `imprimir()` y la pantalla pintaba el cuerpo por su cuenta con
     ReactMarkdown, así que el papel y la pantalla podían discrepar. Ahora los
     dos leen este mismo objeto. */
  const notaRenderData = useMemo(() => {
    if (!consulta || !paciente) return null
    return buildNotaRenderData({ origen: 'consulta', consulta, paciente, addendums, medicoVivo: medicoInfo })
  }, [consulta, paciente, addendums, medicoInfo])

  async function guardarAddendum() {
    if (!addendumTexto.trim()) { setError('El addendum no puede estar vacío'); return }
    setGuardandoAddendum(true)
    setError('')

    const res = await fetch(`/api/consultas/${consultaId}/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: addendumTexto }),
    })

    const data = await res.json()
    setGuardandoAddendum(false)

    if (!res.ok) {
      setError(data.message || data.error || 'No se pudo guardar el addendum')
      return
    }

    setAddendums(prev => [...prev, data.addendum])
    setAddendumTexto('')
    setShowAddendum(false)
    // El PDF ya generado no lleva este addendum: se descarta para que el botón
    // vuelva a "Imprimir" en lugar de ofrecer un enlace a un documento viejo.
    setPdfBlob(null)
  }

  async function imprimir() {
    if (!paciente || !consulta) return
    setError('')
    setImprimiendo(true)
    try {
      // Refresco best-effort: la firma es un signed URL con TTL 1h que pudo
      // expirar si la página lleva rato abierta. Fallo (offline/error) → cae a
      // medicoInfo del estado, sin bloquear la generación. El snapshot
      // definitivo llegará con consultas.medico_firma_path (Paquete Firma).
      let medicoVivo = medicoInfo
      try {
        const { medico } = await fetch('/api/me/perfil-medico').then(r => r.json())
        if (medico) medicoVivo = medico
      } catch { /* sin red: conservar medicoInfo del estado */ }

      const datos = medicoVivo === medicoInfo && notaRenderData
        ? notaRenderData
        : buildNotaRenderData({ origen: 'consulta', consulta, paciente, addendums, medicoVivo })
      const { blob } = await generarPdf({
        tipo: 'nota_evolucion',
        medico: null,
        data: { ...datos },
        logoUrl: datos.medico.logoUrl,
        filename: generateDocFileName(datos.paciente.nombreCompleto, 'Nota-Evolucion'),
        entregar: false,
      })

      setPdfBlob(blob)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ConsultaDetalle] imprimir falló:', err)
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setImprimiendo(false)
    }
  }

  if (loading) return <p className="k-t-sec py-12 text-center" aria-busy="true">Cargando...</p>
  if (!consulta || !paciente) return <p className="k-t-sec py-12 text-center">Consulta no encontrada</p>

  return (
    /* ═══ REDISEÑO B8 (maqueta `final-consulta`) ════════════════════════════
       Columna de lectura centrada (CALMA §14): regreso «‹ <paciente>» (§23.8),
       título, fecha y consultorio, las dos etiquetas («Nota manual»/«Nota IA»
       y «Nota sellada», §11) y la acción de imprimir; debajo, la nota y la
       aclaratoria. La nota NO se edita ni se borra: sólo addendum. */
    <div lang="es" className="mx-auto w-full max-w-[720px] space-y-5 iv:max-w-[600px]">

      <header>
        <Link href={`/expediente/${id}`} className="k-b k-b-texto -ml-1 h-[var(--k-toque)] max-w-full text-[13px]">
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="truncate">{paciente.nombre} {paciente.apellidos}</span>
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="k-t-pantalla">Nota de consulta</h1>
            <p className="k-t-sec mt-1">
              {format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              {consulta.consultorio_nombre && (
                <> · Atendido en: <span className="font-semibold text-tinta">{consulta.consultorio_nombre_corto || consulta.consultorio_nombre}</span></>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {consulta.nota_origen === 'manual'
                ? <span className="k-etq k-etq-tonal"><PenLine aria-hidden="true" /> Nota manual</span>
                : <span className="k-etq k-etq-tonal"><Sparkles aria-hidden="true" /> Nota IA</span>}
              <span className="k-etq k-etq-ok"><Lock aria-hidden="true" /> Nota sellada</span>
            </div>
          </div>
          {/* El enlace se queda hasta que se agregue un addendum (que invalida
              el PDF) o se recargue la página: si el médico cierra la pestaña
              del visor por error, puede volver a abrirla sin regenerar. */}
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noopener" className="k-b k-b-tonal">
              <Eye size={16} aria-hidden="true" /> Abrir PDF
            </a>
          ) : (
            <button onClick={imprimir} disabled={imprimiendo} className="k-b k-b-tonal">
              {imprimiendo
                ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Generando...</>
                : <><Printer size={16} aria-hidden="true" /> Imprimir</>}
            </button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-[var(--r-control)] bg-mal-fondo px-4 py-3 text-[14px] leading-5 text-mal-tinta">{error}</p>}

      {/* ⚠️ EL CONTENIDO DE LA NOTA LO PONE `CuerpoNota`, QUE ES EL MISMO QUE
          USA EL PANEL DE LA PESTAÑA CONSULTAS. Lo que esta página aporta es el
          CHASIS: la cabecera con retorno, las etiquetas, el botón de imprimir y
          el formulario de aclaratoria de aquí abajo. Si necesitas cambiar cómo
          se lee una nota, se cambia en `CuerpoNota` y las dos vistas se
          enteran. */}
      <div className="k-tarjeta">
        {notaRenderData && <CuerpoNota data={notaRenderData} />}
      </div>

      {/* Agregar addendum — siempre visible */}
      {!showAddendum ? (
        <button onClick={() => setShowAddendum(true)} className="k-b k-b-texto -ml-1">
          <Plus size={16} aria-hidden="true" /> Agregar nota aclaratoria (addendum)
        </button>
      ) : (
        <section aria-labelledby="titulo-addendum" className="k-tarjeta space-y-3">
          <h2 id="titulo-addendum" className="k-t-tarjeta">Nueva nota aclaratoria</h2>
          <p className="k-campo-ayuda">
            Este addendum se adjuntará a la nota original y no podrá modificarse una vez guardado.
          </p>
          <textarea
            value={addendumTexto}
            onChange={e => setAddendumTexto(e.target.value)}
            rows={4}
            aria-labelledby="titulo-addendum"
            placeholder="Escriba la aclaración, corrección o nota adicional..."
            autoFocus
            className="k-campo resize-none"
          />
          <div className="flex justify-end gap-2 iv:justify-center">
            <button
              onClick={() => { setShowAddendum(false); setAddendumTexto(''); setError('') }}
              className="k-b k-b-quieto min-w-[104px]"
            >
              Cancelar
            </button>
            <button onClick={guardarAddendum} disabled={guardandoAddendum} className="k-b k-b-prim min-w-[104px]">
              {guardandoAddendum ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Guardando...</> : 'Guardar addendum'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
