'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileDown, Loader2, X } from 'lucide-react'
import type { Paciente, Consulta, MedicoInfo } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useClinica } from '@/hooks/useClinica'
import { buildHojaFrontalData } from '@/lib/hojaFrontalData'
import { buildNotaRenderData } from '@/lib/notaRenderData'
import { componerNombreMedicoCompleto, type CamposNombre } from '@/lib/nombreMedico'
import { generateDocFileName } from '@/lib/patientUtils'
import { generarPdf } from '@/lib/mobileShare'

interface Props {
  paciente: Paciente
}

type AddendumRow = {
  id: string
  consulta_id: string
  contenido: string
  medico_nombre: string
  created_at: string
}

type MedicoClinica = CamposNombre & { id: string; es_admin_de_clinica?: boolean }

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

export default function ExportarExpedienteButton({ paciente }: Props) {
  const { clinica } = useClinica()
  const [generando, setGenerando] = useState(false)
  const [conteo, setConteo] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  /**
   * El botón no abre el PDF: se convierte en el enlace que lo abre.
   *
   * `generarPdf` lo abría él mismo al terminar, después de varias consultas a
   * Supabase, dos fetch y el render de un expediente entero. Para entonces la
   * activación transitoria del gesto ya estaba consumida y Safari bloqueaba la
   * apertura — en silencio en iOS y en la PWA. Aquí duele más que en un
   * documento suelto: el expediente completo NO se persiste (ver el comentario
   * del generarPdf de abajo), así que si no se abre no queda en ninguna parte.
   *
   * Con el href ya resuelto, entre el toque y la navegación no hay asincronía.
   * Mismo criterio que ModalDocumentoGenerado, duplicado a propósito: son doce
   * líneas que no van a divergir y no justifican un hook compartido.
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

  async function exportar() {
    if (generando) return
    setError('')
    setConteo(null)
    setPdfBlob(null)
    setGenerando(true)

    try {
      const supabase = createClient()

      // ── Consultas: fetch propio, SIN límite y en orden cronológico ──
      // No se consumen las props del Hero: ésas vienen acotadas a 50 y en
      // orden descendente, lo que truncaría el expediente en silencio.
      const { data: consultasData, error: errConsultas } = await supabase
        .from('consultas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('fecha', { ascending: true })

      if (errConsultas) throw new Error(errConsultas.message)
      const consultas = (consultasData ?? []) as Consulta[]
      setConteo(consultas.length)

      // ── Addendums de TODAS esas consultas, en un solo query ──
      let addendums: AddendumRow[] = []
      if (consultas.length > 0) {
        const { data } = await supabase
          .from('addendums')
          .select('id, consulta_id, contenido, medico_nombre, created_at')
          .in('consulta_id', consultas.map((c) => c.id))
          .order('created_at', { ascending: true })
        addendums = (data ?? []) as AddendumRow[]
      }

      // ── Perfil vivo, UNA sola vez para las N notas ──
      // La firma es un signed URL con TTL 1h; se refresca aquí y se reutiliza.
      // Best-effort: sin red se genera igual, sin firma.
      let medicoVivo: MedicoInfo | null = null
      try {
        const { medico } = await fetch('/api/me/perfil-medico').then((r) => r.json())
        if (medico) medicoVivo = medico
      } catch {
        /* sin red → las notas salen sin firma ni datos vivos */
      }

      // ── Responsable del expediente = admin de la clínica (custodia NOM-004),
      //    NO el autor de las notas. Fallback defensivo: el médico en sesión. ──
      let responsableNombre = medicoVivo ? componerNombreMedicoCompleto(medicoVivo) : ''
      try {
        const { medicos } = await fetch('/api/clinica/medicos').then((r) => r.json())
        const admin = ((medicos ?? []) as MedicoClinica[]).find((m) => m.es_admin_de_clinica === true)
        if (admin) responsableNombre = componerNombreMedicoCompleto(admin)
      } catch {
        /* sin red → queda el fallback */
      }

      const hojaFrontal = buildHojaFrontalData({
        paciente,
        clinica: {
          nombre: clinica?.nombre_display ?? clinica?.nombre ?? '',
          subtitulo: clinica?.subtitulo,
          logoUrl: clinica?.logo_url,
        },
        responsableNombre,
        // Apertura = primera nota real del expediente (array ascendente).
        fechaAperturaISO: consultas[0]?.fecha ?? null,
        colorPrimario: clinica?.color_primario,
        colorSecundario: clinica?.color_secundario,
      })

      const notas = consultas.map((consulta) =>
        buildNotaRenderData({
          origen: 'consulta',
          consulta,
          paciente,
          addendums: addendums.filter((a) => a.consulta_id === consulta.id),
          medicoVivo,
        }),
      )

      const { blob } = await generarPdf({
        tipo: 'expediente_completo',
        medico: null,
        data: { hojaFrontal, notas },
        logoUrl: clinica?.logo_url ?? medicoVivo?.logo_url ?? undefined,
        filename: generateDocFileName(hojaFrontal.paciente.nombreCompleto, 'Expediente'),
        // SIN pacienteId a propósito: el expediente completo NO se persiste
        // en Storage, solo se entrega al médico.
        entregar: false,
      })

      setPdfBlob(blob)

      // NOM-024: exportar el expediente íntegro no es una lectura más.
      // fire-and-forget, no bloquea ni revierte nada si falla.
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabla: 'pacientes',
          registroId: paciente.id,
          accion: 'exportar_expediente',
        }),
      }).catch(() => {})
    } catch (err) {
      console.error('[ExportarExpediente] falló:', err)
      setError('No se pudo generar el expediente. Intenta de nuevo.')
    } finally {
      setGenerando(false)
      setConteo(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {pdfUrl ? (
        /* El enlace se queda hasta que el médico lo descarte: si cierra la
           pestaña del visor por error, puede volver a abrirla sin regenerar
           el expediente entero. */
        <div className="inline-flex items-center gap-1">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1a3a5c] border border-[#1a3a5c] rounded-xl text-[13px] font-medium text-white hover:bg-[#0f2540] active:scale-[0.98] transition-all duration-200"
            style={{ transitionTimingFunction: IOS_EASING }}
          >
            <FileDown size={14} /> Abrir expediente
          </a>
          <button
            type="button"
            onClick={() => setPdfBlob(null)}
            aria-label="Descartar el expediente generado"
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={exportar}
          disabled={generando}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:active:scale-100"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          {generando ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {conteo === null
                ? 'Generando expediente…'
                : `Generando expediente — ${conteo} ${conteo === 1 ? 'nota' : 'notas'}`}
            </>
          ) : (
            <>
              <FileDown size={14} /> Exportar
            </>
          )}
        </button>
      )}
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  )
}
