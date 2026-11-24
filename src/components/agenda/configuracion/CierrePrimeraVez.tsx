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
 *
 * B13 · AG10 (rediseño, maqueta `ag-pv`, cierre): palomita en círculo `--ok-*`, título de pantalla, y los grupos
 * del kit: «Tu enlace para pacientes» («Copiar enlace» tonal), «¿Es para un solo paciente?» y el resumen como
 * filas con «Cambiar» de texto azul; «Ir a mi agenda» es el relleno.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, Copy, Link2, MessageCircle, User } from 'lucide-react'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import CrearEnlaceUnaVez from '@/components/agenda/configuracion/CrearEnlaceUnaVez'
import { urlWhatsApp } from '@/components/agenda/configuracion/accionesConfig'
import type { PasoPrimeraVez } from '@/lib/agenda/primeraVez'
import { AYUDA, BLOQUE, BOTON_AZUL, BOTON_CHICO, BOTON_TEXTO, CABECERA_PASO, CAJA_AVISO, DIRECCION, ERROR, LISTA, ROTULO, SECCION_PASO, SUB_PASO, TARJETA, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'

export type EnlaceCierre = { estado: 'cargando' } | { estado: 'listo'; url: string } | { estado: 'error'; motivo: string }

interface Props {
  enlace: EnlaceCierre
  /** «No abrirá: …» del enlace del médico, o `null`. */
  aviso: string | null
  medicoId: string
  vigenciaDias: number
  /** `clinica`: el horario de la clínica y su huso, sólo si el funnel llevó ese paso (quien administra; K3). */
  resumen: { consultorios: { id: string; nombre: string; texto: string }[]; minutos: number; avisos: string; clinica: { texto: string; huso: string } | null }
  irAPaso: (p: PasoPrimeraVez) => void
  alCrearUnaVez: () => void
}

/** El rótulo de un grupo, con su icono, fuera de la superficie. */
function Rotulo({ icono: Icono, titulo }: { icono: typeof Link2; titulo: string }) {
  return <h2 className={ROTULO}><Icono size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />{titulo}</h2>
}

function TuEnlace({ enlace, aviso }: Pick<Props, 'enlace' | 'aviso'>) {
  return (
    <section className={BLOQUE} aria-label="Tu enlace para pacientes">
      <Rotulo icono={Link2} titulo="Tu enlace para pacientes" />
      <div className={`${TARJETA} gap-[12px]`}>
        {aviso && <p role="note" className={CAJA_AVISO}>{aviso}</p>}
        {enlace.estado === 'cargando' && <p className={DIRECCION}>Preparando tu enlace…</p>}
        {enlace.estado === 'error' && <p role="alert" className={ERROR}>{enlace.motivo}</p>}
        {enlace.estado === 'listo' && (
          <>
            <p className={`${DIRECCION} rounded-[12px] bg-sup2 px-[14px] py-[10px]`} data-enlace-fijo>{enlace.url}</p>
            <div className="flex flex-wrap gap-[8px]">
              <BotonCopiar texto={enlace.url} etiqueta="Copiar enlace" className={BOTON_CHICO} icono={<Copy size={18} aria-hidden="true" />} />
              <a href={urlWhatsApp(enlace.url)} target="_blank" rel="noopener noreferrer" className={BOTON_TEXTO}>
                <MessageCircle size={18} aria-hidden="true" /> Mandar por WhatsApp
              </a>
            </div>
          </>
        )}
        <p className={`m-0 ${AYUDA}`}>Es el mismo para todos. Ponlo en tu WhatsApp, tu Instagram o tu tarjeta.</p>
      </div>
    </section>
  )
}

function FilaResumen({ titulo, children, alCambiar }: { titulo: string; children: ReactNode; alCambiar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-[12px] py-[10px] pl-[16px] pr-[8px] ih:pl-[20px] iv:pl-[20px] esc:pl-[20px] ih:pr-[12px] iv:pr-[12px] esc:pr-[12px]">
      <div className="flex min-w-0 flex-col gap-[2px] pt-[2px]">
        <span className="text-[13px] font-semibold leading-[18px] text-tinta2">{titulo}</span>
        {children}
      </div>
      <button type="button" className={BOTON_TEXTO} onClick={alCambiar} aria-label={`Cambiar: ${titulo}`}>Cambiar</button>
    </div>
  )
}

const DATO = 'text-[15px] leading-[20px] text-tinta'

function Resumen({ resumen, irAPaso }: Pick<Props, 'resumen' | 'irAPaso'>) {
  return (
    <div className={LISTA}>
        {resumen.clinica && (
          <FilaResumen titulo="Horario de la clínica" alCambiar={() => irAPaso(0)}>
            <span className={DATO}>{resumen.clinica.texto}</span>
            <span className={AYUDA}>Huso horario: {resumen.clinica.huso}</span>
          </FilaResumen>
        )}
        <FilaResumen titulo="Cuándo das consulta" alCambiar={() => irAPaso(1)}>
          {resumen.consultorios.map(c => (
            <span key={c.id} className={DATO}><strong className="font-semibold">{c.nombre}:</strong> {c.texto}</span>
          ))}
        </FilaResumen>
        <FilaResumen titulo="Cuánto dura tu consulta" alCambiar={() => irAPaso(2)}>
          <span className={DATO}>{resumen.minutos} minutos</span>
        </FilaResumen>
        <FilaResumen titulo="Avisos por correo" alCambiar={() => irAPaso(3)}>
          <span className={DATO}>{resumen.avisos}</span>
        </FilaResumen>
    </div>
  )
}

export default function CierrePrimeraVez(p: Props) {
  return (
    <section className={SECCION_PASO} aria-labelledby="primera-vez-titulo">
      <div className={`${CABECERA_PASO} items-start`}>
        <div aria-hidden="true" className="mb-[6px] flex h-[56px] w-[56px] items-center justify-center rounded-full bg-ok-fondo text-ok-tinta">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>Tu agenda ya está lista</h1>
        <p className={SUB_PASO}>Comparte tu enlace. Quien lo abra puede apartar cita en tus horas libres, sin llamarte.</p>
      </div>
      <TuEnlace enlace={p.enlace} aviso={p.aviso} />
      <section className={BLOQUE} aria-label="¿Es para un solo paciente?">
        <Rotulo icono={User} titulo="¿Es para un solo paciente?" />
        <div className={`${TARJETA} gap-[12px]`}>
          <p className={`m-0 ${AYUDA}`}>Crea un enlace de una vez: sirve para una sola cita y deja de funcionar en {p.vigenciaDias} {p.vigenciaDias === 1 ? 'día' : 'días'}.</p>
          <CrearEnlaceUnaVez medicoId={p.medicoId} alCrear={p.alCrearUnaVez} />
        </div>
      </section>
      <Resumen resumen={p.resumen} irAPaso={p.irAPaso} />
      <Link href="/agenda" className={`${BOTON_AZUL} self-end no-underline`}>Ir a mi agenda</Link>
    </section>
  )
}
