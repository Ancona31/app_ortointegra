'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import QRCode from 'qrcode'
import { Medicamento, MedicoInfo } from '@/types'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useProfile } from '@/hooks/useProfile'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { enqueue } from '@/lib/offlineQueue'
import AutocompleteMedicamento from '@/components/AutocompleteMedicamento'
import { MedicamentoDB } from '@/data/medicamentos'

type MedicamentoConVia = Medicamento & { via_administracion?: string }

const VIAS = ['Oral', 'Tópica', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Sublingual', 'Oftálmica', 'Ótica', 'Nasal', 'Inhalatoria', 'Rectal', 'Transdérmica']

const RECOMENDACIONES_PREDETERMINADAS: { label: string; texto: string }[] = [
  {
    label: '🦒 Columna Cervical (Cuello)',
    texto: `Postura: Mantenga la mirada al frente al usar el celular o computadora; evite flexionar el cuello por tiempo prolongado.

Descanso: Use una almohada cervical o una que mantenga su cabeza alineada con la columna.

Calor local: Aplique compresas húmedas-calientes por 15-20 min para relajar la musculatura.

🚨 Datos de Alarma: Pérdida de fuerza en manos, sensación de "toques eléctricos" hacia los brazos o dificultad para abotonarse la camisa.`,
  },
  {
    label: '🎒 Columna Dorsal (Espalda Media)',
    texto: `Carga: Evite cargar mochilas o bolsas pesadas sobre un solo hombro.

Movilidad: Realice ejercicios de extensión torácica y respiraciones profundas varias veces al día.

Ergonomía: Asegúrese de que su silla tenga un soporte adecuado en la zona media de la espalda.

🚨 Datos de Alarma: Dolor opresivo que impide la respiración profunda o dolor que se corre hacia las costillas (tipo cinturón).`,
  },
  {
    label: '🧘 Columna Lumbar (Espalda Baja)',
    texto: `Higiene de Columna: Al levantarse de la cama, hágalo de lado apoyando los brazos. No se doble de cintura para recoger objetos; flexione las rodillas.

Peso: Mantenga su peso ideal para reducir la carga mecánica sobre los discos intervertebrales.

Asientos: Evite sillones muy blandos o permanecer sentado más de 50 minutos seguidos.

🚨 Datos de Alarma: Adormecimiento en la zona genital (silla de montar), pérdida de control de esfínteres o "pie caído" (tropiezos constantes).`,
  },
  {
    label: '⚾ Hombro y Codo',
    texto: `Reposo relativo: Evite levantar el brazo por encima del nivel de la cabeza o cargar objetos pesados con el brazo estirado.

Crioterapia: Aplique hielo envuelto en una toalla por 15 min después de realizar actividades físicas.

Movimiento: Realice ejercicios pendulares (deje colgar el brazo y haga círculos suaves) si su médico lo autorizó.

🚨 Datos de Alarma: Imposibilidad total para elevar el brazo o deformidad evidente ("signo del Popeye").`,
  },
  {
    label: '🖐️ Muñeca y Mano',
    texto: `Férulas: Si se le indicó férula, úsela especialmente durante la noche para evitar posturas viciosas.

Pausas: Si trabaja en computadora, realice estiramientos de flexores y extensores cada hora.

Edema: Mantenga la mano elevada por encima del nivel del corazón si presenta mucha inflamación.

🚨 Datos de Alarma: Dedos morados/fríos o pérdida total de la sensibilidad (anestesia) en las yemas.`,
  },
  {
    label: '🦵 Rodilla',
    texto: `Impacto: Evite saltar, correr en superficies duras o subir/bajar escaleras innecesariamente.

Calzado: Use zapatos con buena amortiguación; evite tacones altos o sandalias totalmente planas.

Control de carga: No permanezca de pie por periodos prolongados.

🚨 Datos de Alarma: Rodilla "trabada" (incapacidad para estirar o doblar), aumento de temperatura local intensa o sensación de inestabilidad ("se le va la rodilla").`,
  },
  {
    label: '🦶 Tobillo y Pie',
    texto: `Elevación: Mantenga el pie elevado con dos almohadas al estar sentado o acostado.

Vendaje: Si usa vendaje elástico, asegúrese de que no esté demasiado apretado; debe poder introducir un dedo bajo la venda.

Apoyo: Respete el tiempo de "no apoyo" si se le indicó el uso de muletas o andadera.

🚨 Datos de Alarma: Hinchazón excesiva de la pantorrilla con dolor al tocarla (posible coágulo) o cambios de coloración en los dedos.`,
  },
  {
    label: '📍 Fisioterapia y Rehabilitación',
    texto: `Asistencia: Cumplir con un ciclo inicial de 10 sesiones para asegurar resultados.

Frecuencia: Se sugiere acudir de 2 a 3 veces por semana según la disponibilidad.

Objetivos: Enfoque en higiene de columna, fortalecimiento de core y estiramientos analíticos.

Modalidades: Aplicación de medios físicos, electrotermoterapia y terapia manual.

Restricciones: Evitar cargar objetos pesados (>5 kg) y movimientos de rotación brusca.

Seguimiento: Al concluir las sesiones, solicitar reporte de evolución para su revaloración en consulta.

💡 Nota importante: La constancia en su rehabilitación es la clave para una recuperación exitosa y para prevenir futuras lesiones. ¡Su esfuerzo hoy es su movilidad mañana!`,
  },
  {
    label: '✂️ Cuidados de la Herida Quirúrgica (Postoperados)',
    texto: `Limpieza: Lave la herida solo con agua y jabón neutro durante el baño diario. Seque con toques suaves usando una gasa estéril o toalla limpia exclusiva.

Exposición: Mantenga la herida cubierta con una gasa seca a menos que su cirujano indique dejarla al aire.

Prohibido: No aplique alcohol, agua oxigenada, pomadas, cremas, remedios caseros o "chochitos" sobre la incisión.

Actividad: Evite esfuerzos físicos que puedan "estirar" la cicatriz y causar que se abra (dehiscencia).

🚨 Datos de Alarma en la Herida:
• Salida de líquido amarillento, espeso o con mal olor (pus).
• Enrojecimiento que se extiende más allá de los bordes de la herida.
• Fiebre mayor a 38°C persistente.
• Apertura de los puntos de sutura.`,
  },
]

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  medicamentosIniciales?: MedicamentoConVia[]
}

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, medicamentosIniciales }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const { isSuperAdmin } = useProfile()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pacienteData, setPacienteData] = useState<{ edad?: number | null; sexo?: string } | null>(null)

  useEffect(() => {
    if (!pacienteId) return
    const supabase = createClient()
    supabase.from('pacientes').select('fecha_nacimiento, sexo').eq('id', pacienteId).single()
      .then((res: { data: { fecha_nacimiento: string | null; sexo: string | null } | null }) => {
        const data = res.data
        if (data) {
          const edad = data.fecha_nacimiento
            ? Math.floor((Date.now() - new Date(data.fecha_nacimiento).getTime()) / (365.25 * 24 * 3600 * 1000))
            : null
          setPacienteData({ edad, sexo: data.sexo ?? undefined })
        }
      })
  }, [pacienteId])

  const medInicial: MedicamentoConVia[] = medicamentosIniciales && medicamentosIniciales.length > 0
    ? medicamentosIniciales
    : [{ nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }]

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [medicamentos, setMedicamentos] = useState<MedicamentoConVia[]>(medInicial)
  const [sugerenciasDosis, setSugerenciasDosis] = useState<string[]>(medInicial.map(() => ''))
  const [recomendaciones, setRecomendaciones] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addMed() {
    setMedicamentos([...medicamentos, { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }])
    setSugerenciasDosis(prev => [...prev, ''])
  }

  function removeMed(i: number) {
    setMedicamentos(medicamentos.filter((_, idx) => idx !== i))
    setSugerenciasDosis(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMed(i: number, field: keyof Medicamento, val: string) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function autocompletarMed(i: number, med: MedicamentoDB) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? {
      ...m,
      nombre_comercial: med.nombre_comercial,
      presentacion: med.presentacion,
      principio_activo: med.principio_activo,
    } : m))
    setSugerenciasDosis(prev => prev.map((s, idx) => idx === i ? med.dosis_sugerida : s))
  }

  async function imprimir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })
    try {
    const folio = `R-${Date.now().toString().slice(-8)}`
    const contenido = {
      folio,
      paciente,
      diagnostico,
      medicamentos,
      recomendaciones,
      fecha,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      medico_nombre: medicoInfo?.nombre || '',
      medico_especialidad: medicoInfo?.especialidad || '',
      medico_cedula_profesional: medicoInfo?.cedula_profesional || '',
      medico_cedula_especialidad: medicoInfo?.cedula_especialidad || '',
      clinica_nombre: medicoInfo?.clinica_nombre || '',
      color_primario: medicoInfo?.color_primario || '#1a3a5c',
      color_secundario: medicoInfo?.color_secundario || '#1e5fa8',
    }

    const supabase = createClient()
    const { error: saveError } = await supabase.from('documentos').insert({
      ...(pacienteId ? { paciente_id: pacienteId } : {}),
      tipo: 'receta',
      contenido,
    })
    if (saveError) {
      // Guardar en cola offline — se sincronizará automáticamente cuando vuelva la conexión
      await enqueue({
        paciente_id: pacienteId || undefined,
        tipo: 'receta',
        contenido,
      })
      setErrorGuardado('Sin conexión — la receta se guardará automáticamente cuando vuelva el internet.')
    }

    const verificacionUrl = `${window.location.origin}/r/${folio}`
    const [qrDataUrl, blogQrDataUrl] = await Promise.all([
      QRCode.toDataURL(verificacionUrl, { width: 96, margin: 1, color: { dark: '#1a3a5c', light: '#ffffff' } }),
      isSuperAdmin
        ? QRCode.toDataURL('https://dranconacolumna.com/articulos.html', { width: 64, margin: 1, color: { dark: medicoInfo?.color_primario || '#1a3a5c', light: '#ffffff' } })
        : Promise.resolve(''),
    ])

    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

    const medsData = medicamentos.filter(m => m.nombre_comercial)
    const meds = medsData.length === 0 ? '' : `
      <table class="meds-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-med">Medicamento</th>
            <th class="col-via">Vía</th>
            <th class="col-ind">Indicaciones</th>
          </tr>
        </thead>
        <tbody>
          ${medsData.map((m, i) => `
          <tr>
            <td class="col-num num-cell">${i + 1}</td>
            <td class="col-med">
              <span class="med-nombre">${m.nombre_comercial.toUpperCase()}${m.presentacion ? ` <span class="med-pres">${m.presentacion}</span>` : ''}</span>
              ${m.principio_activo ? `<br><span class="principio">(${m.principio_activo})</span>` : ''}
            </td>
            <td class="col-via via-cell">${m.via_administracion || 'Oral'}</td>
            <td class="col-ind ind-cell">${m.indicacion || ''}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    `

    const doctorNombre = medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = medicoInfo?.especialidad || ''
    const cedProf = medicoInfo?.cedula_profesional || ''
    const cedEsp = medicoInfo?.cedula_especialidad || ''
    const direccion = medicoInfo?.direccion_consultorio || ''
    const telefono = medicoInfo?.telefono_consultorio || ''
    const logoUrl = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://') ? medicoInfo.logo_url : `${window.location.origin}/logo.png`
    const cp = medicoInfo?.color_primario || '#1a3a5c'
    const cs = medicoInfo?.color_secundario || '#1e5fa8'
    const edadPaciente = pacienteData?.edad
    const sexoPaciente = pacienteData?.sexo === 'M' ? 'Masculino' : pacienteData?.sexo === 'F' ? 'Femenino' : pacienteData?.sexo || ''
    const marcaAguaUrl = logoUrl

    const _html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Receta — ${paciente}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Serif&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; position: relative; }

  /* ── Marca de agua ── */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    width: 320px; height: 320px;
    object-fit: contain; opacity: 0.06;
    pointer-events: none; z-index: 0;
  }

  /* ── Barra superior ── */
  .barra-top {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 12px; width: 100%;
  }

  /* ── Contenido principal ── */
  .contenido { padding: 14mm 18mm 10mm; position: relative; z-index: 1; }

  /* ── Encabezado ── */
  .header {
    display: flex; align-items: center; gap: 18px;
    padding-bottom: 14px; margin-bottom: 14px;
    border-bottom: 2px solid ${cp};
  }
  .logo-wrap {
    width: 78px; height: 78px; border-radius: 50%;
    border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: #f8fafc;
  }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 15pt; font-weight: bold; color: ${cp}; line-height: 1.2; font-family: Arial, sans-serif; }
  .especialidad { font-size: 9.5pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8.5pt; color: #666; }
  .contacto-consultorio { font-size: 8pt; color: #888; margin-top: 3px; }
  .rp-wrap { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .rp { font-size: 52pt; font-weight: 900; color: ${cs}; line-height: 1; opacity: 0.85; font-family: Arial, sans-serif; }
  .folio { font-size: 7.5pt; color: #aaa; text-align: right; margin-top: 2px; font-family: Arial, sans-serif; }
  .blog-qr { width: 46px; height: 46px; margin-top: 5px; }
  .blog-qr-label { font-size: 5.5pt; color: #bbb; text-align: center; line-height: 1.3; font-family: Arial, sans-serif; margin-top: 2px; }

  /* ── Datos del paciente ── */
  .datos-box {
    background: linear-gradient(135deg, ${cp}08, ${cs}08);
    border-left: 4px solid ${cs};
    border-radius: 0 6px 6px 0;
    padding: 10px 14px; margin-bottom: 16px;
  }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9.5pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8.5pt; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.3px; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }

  /* ── Sección header ── */
  .seccion-header {
    display: flex; align-items: center; gap: 8px;
    margin: 16px 0 10px;
  }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo {
    font-size: 8pt; font-weight: bold; color: ${cp};
    text-transform: uppercase; letter-spacing: 1.5px;
    font-family: Arial, sans-serif;
    background: ${cp}12; padding: 3px 10px; border-radius: 20px;
  }

  /* ── Tabla de medicamentos ── */
  .meds-table {
    width: 100%; border-collapse: collapse;
    font-family: Arial, sans-serif;
  }
  .meds-table thead tr {
    background: linear-gradient(135deg, ${cp}, ${cs});
  }
  .meds-table thead th {
    color: #fff; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.8px;
    padding: 6px 10px; text-align: left;
  }
  .meds-table thead th.col-num { text-align: center; width: 24px; }
  .meds-table tbody tr { border-bottom: 1px solid ${cp}18; }
  .meds-table tbody tr:last-child { border-bottom: none; }
  .meds-table tbody tr:nth-child(even) { background: ${cp}05; }
  .meds-table td { padding: 8px 10px; vertical-align: top; font-size: 9.5pt; }
  .num-cell { text-align: center; color: ${cs}; font-weight: 700; font-size: 9pt; }
  .med-nombre { font-weight: 700; color: #111; font-size: 10pt; }
  .med-pres { font-weight: 400; color: #555; font-size: 9pt; }
  .principio { font-style: italic; color: #777; font-size: 8.5pt; }
  .via-cell { color: ${cs}; font-weight: 600; font-size: 8.5pt; white-space: nowrap; }
  .ind-cell { color: #444; line-height: 1.55; }

  .recomendaciones { font-size: 9pt; line-height: 1.35; color: #333; padding-left: 10px; }
  .recomendaciones p { margin: 0 0 3px 0; }
  .recomendaciones .rec-header { font-weight: 700; color: ${cp}; font-size: 9.5pt; margin: 8px 0 2px 0; display: block; }
  .recomendaciones .rec-header:first-child { margin-top: 0; }
  .recomendaciones .rec-keyword { font-weight: 700; color: ${cs}; }
  .recomendaciones .rec-alarma { font-weight: 700; color: #c0392b; }
  .recomendaciones .rec-bullet { padding-left: 10px; color: #444; font-style: italic; }

  /* ── Barra inferior + firma ── */
  .footer-area { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  .qr-area { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .qr-img { width: 72px; height: 72px; }
  .qr-label { font-size: 6.5pt; color: #aaa; font-family: Arial, sans-serif; text-align: center; line-height: 1.4; }
  .firma {
    text-align: center; min-width: 220px;
    border-top: 1.5px solid ${cp}; padding-top: 8px;
  }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; font-family: Arial, sans-serif; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }

  .barra-bottom {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 8px; width: 100%; margin-top: 18px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .barra-top, .barra-bottom { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <img class="watermark" src="${marcaAguaUrl}" onerror="this.style.display='none'" />

  <div class="barra-top"></div>

  <div class="contenido">

    <div class="header">
      <div class="logo-wrap">
        <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
      </div>
      <div class="header-info">
        <div class="doctor-name">${doctorNombre}</div>
        ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
        <div class="credenciales">
          ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
          ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
          ${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}
        </div>
        ${direccion || telefono ? `<div class="contacto-consultorio">${[direccion, telefono ? `Tel: ${telefono}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      </div>
      <div class="rp-wrap">
        <div class="rp">Rx</div>
        <div class="folio">${folio}</div>
        ${isSuperAdmin && blogQrDataUrl ? `<img class="blog-qr" src="${blogQrDataUrl}" /><div class="blog-qr-label">Blog del Dr.</div>` : ''}
      </div>
    </div>

    <div class="datos-box">
      <div class="datos-grid">
        <div class="dato"><span class="dato-label">Fecha</span><span class="dato-valor">${fechaFormat}</span></div>
        <div class="dato"><span class="dato-label">Paciente</span><span class="dato-valor">${paciente}</span></div>
        ${edadPaciente != null ? `<div class="dato"><span class="dato-label">Edad</span><span class="dato-valor">${edadPaciente} años</span></div>` : ''}
        ${sexoPaciente ? `<div class="dato"><span class="dato-label">Sexo</span><span class="dato-valor">${sexoPaciente}</span></div>` : ''}
        ${diagnostico ? `<div class="dato" style="grid-column:span 2"><span class="dato-label">Diagnóstico</span><span class="dato-valor">${diagnostico}</span></div>` : ''}
      </div>
    </div>

    <div class="seccion-header">
      <div class="seccion-linea"></div>
      <div class="seccion-titulo">Medicamentos</div>
      <div class="seccion-linea"></div>
    </div>

    ${meds}

    ${recomendaciones ? `
    <div class="seccion-header">
      <div class="seccion-linea"></div>
      <div class="seccion-titulo">Recomendaciones</div>
      <div class="seccion-linea"></div>
    </div>
    <div class="recomendaciones">${
      recomendaciones.split('\n').map(line => {
        const t = line.trim()
        if (!t) return '<div style="height:2px"></div>'
        // Línea de encabezado de segmento (contiene emoji al inicio)
        if (/^[\u{1F300}-\u{1FAFF}✂️]/u.test(t))
          return `<span class="rec-header">${t}</span>`
        // Datos de alarma
        if (/^🚨/.test(t))
          return `<p><span class="rec-alarma">${t}</span></p>`
        // Bullet points
        if (/^[•\-]/.test(t))
          return `<p class="rec-bullet">${t}</p>`
        // Línea con "Keyword: texto" — keyword en bold color
        if (/^[A-ZÁÉÍÓÚÑÜ][^:]{2,25}:/.test(t)) {
          const idx = t.indexOf(':')
          const key = t.slice(0, idx)
          const rest = t.slice(idx + 1)
          return `<p><span class="rec-keyword">${key}:</span><em>${rest}</em></p>`
        }
        return `<p>${t}</p>`
      }).join('')
    }</div>
    ` : ''}

    <div class="footer-area">
      <div class="qr-area">
        <img class="qr-img" src="${qrDataUrl}" />
        <div class="qr-label">Escanea para<br>verificar receta</div>
      </div>
      <div class="firma">
        <div class="firma-nombre">${doctorNombre}</div>
        ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
        ${cedEsp ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>` : ''}
      </div>
    </div>

  </div>

  <div class="barra-bottom"></div>

</body>
</html>
    `
    await imprimirOCompartir(_html, 'receta-medica.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Datos básicos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nombre del paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
        </div>
      </div>

      {/* Medicamentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Medicamentos</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {medicamentos.map((med, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">MEDICAMENTO {i + 1}</span>
                {medicamentos.length > 1 && (
                  <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Nombre comercial</label>
                  <AutocompleteMedicamento
                    value={med.nombre_comercial}
                    onChange={val => updateMed(i, 'nombre_comercial', val)}
                    onSelect={m => autocompletarMed(i, m)}
                    placeholder="VOLTAREN"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Presentación</label>
                  <input type="text" value={med.presentacion || ''} onChange={e => updateMed(i, 'presentacion', e.target.value)}
                    placeholder="Tabletas 50 mg" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Vía de administración</label>
                  <select value={(med as MedicamentoConVia).via_administracion || 'Oral'} onChange={e => updateMed(i, 'via_administracion' as any, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                    {VIAS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Principio activo</label>
                  <input type="text" value={med.principio_activo || ''} onChange={e => updateMed(i, 'principio_activo', e.target.value)}
                    placeholder="Diclofenaco sódico" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Indicaciones de administración</label>
                  <textarea value={med.indicacion} onChange={e => updateMed(i, 'indicacion', e.target.value)}
                    placeholder="Tomar 1 tableta cada 8 hrs con alimentos por 7 días"
                    rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  {sugerenciasDosis[i] && (
                    <p className="mt-1 text-xs text-slate-400 flex items-start gap-1">
                      <span className="font-medium text-slate-500">Sugerencia:</span> {sugerenciasDosis[i]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Botón al pie del último medicamento */}
          <div className="px-4 py-3">
            <button onClick={addMed}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors">
              <Plus size={14} /> Agregar medicamento
            </button>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">Recomendaciones / Notas</label>
          {recomendaciones && (
            <button
              onClick={() => setRecomendaciones('')}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
        <select
          defaultValue=""
          onChange={e => {
            if (!e.target.value) return
            const rec = RECOMENDACIONES_PREDETERMINADAS.find(r => r.label === e.target.value)
            if (rec) {
              const bloque = `${rec.label}\n${rec.texto}`
              setRecomendaciones(prev => prev ? prev + '\n\n' + bloque : bloque)
            }
            e.target.value = ''
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 bg-slate-50"
        >
          <option value="">＋ Insertar recomendaciones predeterminadas...</option>
          {RECOMENDACIONES_PREDETERMINADAS.map(r => (
            <option key={r.label} value={r.label}>{r.label}</option>
          ))}
        </select>
        <textarea
          value={recomendaciones}
          onChange={e => setRecomendaciones(e.target.value)}
          placeholder="Selecciona un segmento arriba o escribe tus propias recomendaciones..."
          rows={6}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
        />
      </div>

      {errorGuardado && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorGuardado}
        </p>
      )}

      <button
        onClick={imprimir}
        disabled={!paciente || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Receta</>}
      </button>
    </div>
  )
}
