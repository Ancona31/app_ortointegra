'use client'

interface DicomMeta {
  patientName?: string
  patientId?: string
  studyDate?: string
  modality?: string
  studyDescription?: string
  seriesDescription?: string
  sliceThickness?: string
  kvp?: string
  rows?: string
  columns?: string
  instanceNumber?: string
  manufacturer?: string
}

interface Props {
  meta: DicomMeta | null
  totalSlices: number
  currentSlice: number
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-slate-200 break-words">{value}</span>
    </div>
  )
}

export default function DicomMetadataPanel({ meta, totalSlices, currentSlice }: Props) {
  return (
    <div className="w-52 shrink-0 bg-slate-900 rounded-lg p-3 overflow-y-auto text-left space-y-3 border border-slate-700">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Metadatos DICOM</p>

      <Row label="Paciente"      value={meta?.patientName} />
      <Row label="ID"            value={meta?.patientId} />
      <Row label="Fecha estudio" value={meta?.studyDate} />
      <Row label="Modalidad"     value={meta?.modality} />
      <Row label="Estudio"       value={meta?.studyDescription} />
      <Row label="Serie"         value={meta?.seriesDescription} />
      <Row label="Fabricante"    value={meta?.manufacturer} />
      <Row label="kVp"           value={meta?.kvp} />
      <Row label="Grosor corte"  value={meta?.sliceThickness ? `${meta.sliceThickness} mm` : undefined} />
      <Row label="Dimensiones"   value={meta?.rows && meta?.columns ? `${meta.columns} × ${meta.rows} px` : undefined} />

      <div className="pt-1 border-t border-slate-700">
        <Row label="Imágenes" value={totalSlices > 0 ? `${currentSlice + 1} / ${totalSlices}` : undefined} />
      </div>
    </div>
  )
}

export type { DicomMeta }
