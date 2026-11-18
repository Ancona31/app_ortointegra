'use client'

/**
 * El cierre del funnel, «Tu agenda ya está lista» (tanda J, J5, punto 13;
 * maqueta `Main.dc.html`): el enlace fijo del médico con «Copiar enlace» y
 * «Mandar por WhatsApp», el enlace de una vez y el resumen con «Cambiar» en
 * cada parte. La dirección es la real, `/reservar/{código}` (punto 17); la de
 * la maqueta es de adorno.
 *
 * Lo que la maqueta no dibuja y se conserva: si el enlace no abrirá (aviso
 * pendiente, clínica sin acceso…) se dice encima, con la misma frase que la
 * configuración (`avisoDeEnlace`); si no se pudo crear, el motivo.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import CrearEnlaceUnaVez from '@/components/agenda/configuracion/CrearEnlaceUnaVez'
import { urlWhatsApp } from '@/components/agenda/configuracion/accionesConfig'
import { AYUDA, BOTON_AZUL, BOTON_BLANCO, BOTON_TEXTO, DIRECCION, ERROR, SUB_PASO, TARJETA, TITULO_BLOQUE, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'

export type EnlaceCierre = { estado: 'cargando' } | { estado: 'listo'; url: string } | { estado: 'error'; motivo: string }

interface Props {
  enlace: EnlaceCierre
  /** «No abrirá: …» del enlace del médico, o `null`. */
  aviso: string | null
  medicoId: string
  vigenciaDias: number
  resumen: { consultorios: { id: string; nombre: string; texto: string }[]; minutos: number; avisos: string }
  irAPaso: (p: 1 | 2 | 3) => void
  alCrearUnaVez: () => void
}

function TuEnlace({ enlace, aviso }: Pick<Props, 'enlace' | 'aviso'>) {
  return (
    <div className={`${TARJETA} gap-[14px] border-2 border-[var(--ag-brand-secondary)]`}>
      <span className="text-[15px] font-bold text-[var(--ag-brand-legible)]">Tu enlace para pacientes</span>
      {aviso && <p role="note" className="m-0 rounded-[10px] border border-[var(--ag-aviso-border)] bg-[var(--ag-aviso-bg)] px-[14px] py-[10px] text-[15px] text-[var(--ag-aviso-text)]">{aviso}</p>}
      {enlace.estado === 'cargando' && <div className={DIRECCION}>Preparando tu enlace…</div>}
      {enlace.estado === 'error' && <p role="alert" className={ERROR}>{enlace.motivo}</p>}
      {enlace.estado === 'listo' && (
        <>
          <div className={DIRECCION} data-enlace-fijo>{enlace.url}</div>
          <div className="flex flex-wrap gap-[10px]">
            <BotonCopiar texto={enlace.url} etiqueta="Copiar enlace" className={BOTON_AZUL} icono={<Copy size={18} aria-hidden="true" />} />
            <a href={urlWhatsApp(enlace.url)} target="_blank" rel="noopener noreferrer" className={BOTON_BLANCO}>
              <MessageCircle size={18} aria-hidden="true" /> Mandar por WhatsApp
            </a>
          </div>
        </>
      )}
      <p className={`m-0 ${AYUDA}`}>Es el mismo para todos. Ponlo en tu WhatsApp, tu Instagram o tu tarjeta.</p>
    </div>
  )
}

function FilaResumen({ titulo, children, alCambiar, ultima }: { titulo: string; children: ReactNode; alCambiar: () => void; ultima?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-[16px] py-[14px] ${ultima ? '' : 'border-b border-[var(--ag-hairline)]'}`}>
      <div className="flex flex-col gap-[4px]">
        <span className="text-[14px] font-semibold text-[var(--ag-ink-600)]">{titulo}</span>
        {children}
      </div>
      <button type="button" className={BOTON_TEXTO} onClick={alCambiar} aria-label={`Cambiar: ${titulo}`}>Cambiar</button>
    </div>
  )
}

function Resumen({ resumen, irAPaso }: Pick<Props, 'resumen' | 'irAPaso'>) {
  return (
    <div className={`${TARJETA} px-[24px] py-[8px]`}>
      <FilaResumen titulo="Cuándo das consulta" alCambiar={() => irAPaso(1)}>
        {resumen.consultorios.map(c => (
          <span key={c.id} className="text-[15px] text-[var(--ag-ink)]"><strong>{c.nombre}:</strong> {c.texto}</span>
        ))}
      </FilaResumen>
      <FilaResumen titulo="Cuánto dura tu consulta" alCambiar={() => irAPaso(2)}>
        <span className="text-[15px] text-[var(--ag-ink)]">{resumen.minutos} minutos</span>
      </FilaResumen>
      <FilaResumen titulo="Avisos por correo" alCambiar={() => irAPaso(3)} ultima>
        <span className="text-[15px] text-[var(--ag-ink)]">{resumen.avisos}</span>
      </FilaResumen>
    </div>
  )
}

export default function CierrePrimeraVez(p: Props) {
  return (
    <section className="flex flex-col gap-[20px]" aria-labelledby="primera-vez-titulo">
      <div className="flex flex-col items-start gap-[12px]">
        <div aria-hidden="true" className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[var(--ag-success-bg)] text-[var(--ag-success-text)]">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>Tu agenda ya está lista</h1>
        <p className={SUB_PASO}>Comparte tu enlace. Quien lo abra puede apartar cita en tus horas libres, sin llamarte.</p>
      </div>
      <TuEnlace enlace={p.enlace} aviso={p.aviso} />
      <div className={`${TARJETA} gap-[12px] px-[24px] py-[22px]`}>
        <span className={TITULO_BLOQUE}>¿Es para un solo paciente?</span>
        <span className={AYUDA}>Crea un enlace de una vez: sirve para una sola cita y deja de funcionar en {p.vigenciaDias} {p.vigenciaDias === 1 ? 'día' : 'días'}.</span>
        <CrearEnlaceUnaVez medicoId={p.medicoId} alCrear={p.alCrearUnaVez} />
      </div>
      <Resumen resumen={p.resumen} irAPaso={p.irAPaso} />
      <Link href="/agenda" className={`${BOTON_AZUL} self-start px-[28px] no-underline`}>Ir a mi agenda</Link>
    </section>
  )
}
