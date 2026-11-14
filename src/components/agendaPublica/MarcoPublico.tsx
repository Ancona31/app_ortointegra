import type { ReactElement, ReactNode } from 'react'
import './agendaPublica.css'

/* ═══ El marco de las páginas públicas de la agenda (tanda G1) ═══
   Cabecera navy con la marca de Spinus y, si se da, la tarjeta del médico;
   debajo, la columna del contenido. Lo usan `/reservar/{código}` (la reserva
   y «Este enlace ya no está disponible») y `/confirmar/{código}`: tres usos.

   ⚠️ NADA CLÍNICO: el médico va con su nombre y, sólo si quien llama la pasa,
   la especialidad. La confirmación NO la pasa (vistaConfirmacion.ts, lista A
   16); la reserva sí (D5: es lo que el paciente elige).

   El símbolo es `/logo.png` (el del menú lateral) sobre su placa blanca, con
   `alt=""` porque «Spinus» va a su lado como texto: anunciarlo dos veces es
   ruido. `<img>` y no `next/image`: 24 px fijos, sin optimizador que hacer
   pasar por una ruta pública. */

export interface MedicoMarco { nombre: string; especialidad?: string | null }

function iniciales(nombre: string): string {
  const palabras = nombre.replace(/^(Dra?|Lic|Mtr[oa])\.?\s+/i, '').split(/\s+/).filter(Boolean)
  return palabras.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

export default function MarcoPublico({ medico, children }: { medico?: MedicoMarco | null; children: ReactNode }): ReactElement {
  return (
    <div className="rp">
      <header className="rp-cab">
        <div className="rp-col">
          <div className="rp-marca">
            {/* eslint-disable-next-line @next/next/no-img-element -- ver la cabecera */}
            <span className="rp-marca__placa"><img src="/logo.png" alt="" width={24} height={24} /></span>
            Spinus
          </div>
          {medico?.nombre && (
            <div className="rp-medico">
              <span className="rp-medico__ini" aria-hidden="true">{iniciales(medico.nombre)}</span>
              <div>
                <span className="rp-medico__nombre">{medico.nombre}</span>
                {medico.especialidad && <span className="rp-medico__esp">{medico.especialidad}</span>}
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="rp-main"><div className="rp-col">{children}</div></main>
    </div>
  )
}
