/**
 * IconoTipoDocumento.tsx — el icono de cada tipo de documento en su color
 * (CALMA §9 y §11; siempre el mismo tono y el mismo icono por tipo).
 *
 * Primitiva del rediseño (B2): dibuja `.k-doc` de `sistema.css`. Los ocho
 * iconos son los de `doc-color/color-documentos.html` (trazo 1,8, 24×24),
 * copiados tal cual.
 *
 * `nivel`:
 *   'lista'   (por defecto) icono de 20 en su `--d-*`, sin fondo. Para lo que
 *             YA existe: documentos del paciente, recientes, línea de tiempo.
 *   'rejilla' el mismo icono en un cuadro de 32, radio 9, con su tinte. Para
 *             ELEGIR qué crear (rejilla «Tipo de documento», CALMA §21).
 * Fuera de esos dos usos el color de documento no se usa.
 *
 * `tipo` admite el valor de `documentos.tipo` (`solicitud_lab`…) y la clave
 * corta del catálogo (`lab`…): ver `familias.ts`, son dos nombres distintos y
 * los dos circulan. Decorativo (`aria-hidden`): el nombre va al lado.
 */
import type { ReactElement, ReactNode } from 'react'

export type ClaveDocumento =
  | 'receta' | 'laboratorio' | 'imagen' | 'suplementacion' | 'internamiento'
  | 'escrito' | 'consentimiento' | 'honorarios' | 'otro'

/** Tipo de la base o clave del catálogo → clave de color e icono. */
const CLAVE: Record<string, ClaveDocumento> = {
  receta: 'receta',
  solicitud_lab: 'laboratorio', lab: 'laboratorio', resultado_laboratorio: 'laboratorio',
  solicitud_imagen: 'imagen', imagen: 'imagen', estudio_imagen: 'imagen',
  plan_suplementacion: 'suplementacion', suplementacion: 'suplementacion',
  solicitud_internamiento: 'internamiento', internamiento: 'internamiento',
  escrito_medico: 'escrito', escrito: 'escrito', informe_clinico: 'escrito',
  consentimiento_informado: 'consentimiento', consentimiento: 'consentimiento',
  denegacion_consentimiento: 'consentimiento',
  nota_honorarios: 'honorarios', honorarios: 'honorarios',
}

/** La clave de un tipo; `otro` (gris, icono genérico) si no se conoce. */
export function claveDocumento(tipo: string): ClaveDocumento {
  return CLAVE[tipo] ?? 'otro'
}

const TRAZO: Record<ClaveDocumento, ReactNode> = {
  receta: <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>,
  laboratorio: <><path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2" /><path d="M8.5 2h7M7 16h10" /></>,
  imagen: <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />,
  suplementacion: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6" /></>,
  internamiento: <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20" />,
  escrito: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  consentimiento: <><path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  honorarios: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11" /></>,
  otro: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
}

export interface IconoTipoDocumentoProps {
  tipo: string
  nivel?: 'lista' | 'rejilla'
  className?: string
}

export default function IconoTipoDocumento({ tipo, nivel = 'lista', className }: IconoTipoDocumentoProps): ReactElement {
  const clave = claveDocumento(tipo)
  const clases = ['k-doc', clave === 'otro' ? '' : `k-doc-${clave}`, nivel === 'rejilla' ? 'k-doc-caja' : '', className ?? '']
    .filter(Boolean).join(' ')
  return (
    <span className={clases} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {TRAZO[clave]}
      </svg>
    </span>
  )
}
