import type { ReactElement } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { ENCARGO_PLANTILLA } from './textoEncargo'

/* ═══ La sección de encargo de los Términos (privacidad 2026-12, documento 4) ═══
   «Tratamiento de datos personales por cuenta del Usuario».

   ⚠️ EL TEXTO NO ESTÁ AQUÍ: es `ENCARGO_PLANTILLA` (`textoEncargo.ts`), copia
   literal del documento aprobado. Este archivo sólo lo pinta, poniendo el
   número de la sección donde el documento dice `[N]`. Aquí no se redacta.

   La primera línea del documento («# Sección [N]. …») es el título de la
   sección y lo pone quien la monta (`TITULO_ENCARGO`); el resto va tal cual.

   LA TABLA de subencargados se pinta a mano porque `react-markdown` sin
   `remark-gfm` no entiende tablas y el proyecto no añade dependencias: el
   texto se parte en «antes de la tabla», la tabla y «después», y la lista
   numerada que la tabla interrumpe sigue en el 2 (`start`). */

const [TITULO_MD = '', ...RESTO] = ENCARGO_PLANTILLA.split('\n')

/** «Tratamiento de datos personales por cuenta del Usuario», sin «Sección [N].». */
export const TITULO_ENCARGO = TITULO_MD.replace(/^# Sección \[N\]\.\s*/, '')

interface Partes { antes: string; filas: string[][]; despues: string }

function partir(num: string): Partes {
  const lineas = RESTO.map(l => l.replaceAll('[N]', num))
  const esTabla = (l: string) => l.startsWith('|')
  const desde = lineas.findIndex(esTabla)
  const hasta = lineas.findLastIndex(esTabla)
  const celdas = (l: string) => l.split('|').slice(1, -1).map(c => c.trim())
  return {
    antes: lineas.slice(0, desde).join('\n'),
    filas: lineas.slice(desde, hasta + 1).filter(l => !/^\|[\s|-]+\|$/.test(l)).map(celdas),
    despues: lineas.slice(hasta + 1).join('\n'),
  }
}

const ROPA: Components = {
  h2: ({ children }) => <h3 className="font-semibold text-[#1d1d1f] text-[14px] pt-3">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 text-[13px]">{children}</ul>,
  ol: ({ children, start }) => <ol start={start} className="list-decimal pl-5 space-y-1 text-[13px]">{children}</ol>,
  strong: ({ children }) => <strong className="text-[#1d1d1f]">{children}</strong>,
}

function Tabla({ filas }: { filas: string[][] }): ReactElement {
  const [cabecera = [], ...cuerpo] = filas
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px] border-collapse">
        <thead>
          <tr>{cabecera.map(c => <th key={c} scope="col" className="border-b border-slate-200 py-2 pr-3 font-semibold text-[#1d1d1f]">{c}</th>)}</tr>
        </thead>
        <tbody>
          {cuerpo.map(fila => (
            <tr key={fila[0]}>{fila.map(c => <td key={c} className="border-b border-slate-100 py-2 pr-3 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** El cuerpo de la sección, con `num` donde el documento dice `[N]`. */
export default function SeccionEncargo({ num }: { num: string }): ReactElement {
  const { antes, filas, despues } = partir(num)
  return (
    <>
      <ReactMarkdown components={ROPA} disallowedElements={['a', 'img']} unwrapDisallowed>{antes}</ReactMarkdown>
      <Tabla filas={filas} />
      <ReactMarkdown components={ROPA} disallowedElements={['a', 'img']} unwrapDisallowed>{despues}</ReactMarkdown>
    </>
  )
}
