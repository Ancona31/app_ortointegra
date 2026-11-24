import type { Metadata, Viewport } from 'next'
import type { ReactElement } from 'react'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { textoAviso } from '@/lib/reserva/avisoReserva'
import { AVISO_INTEGRAL_FECHA, AVISO_INTEGRAL_PLANTILLA } from '@/lib/reserva/avisoIntegral'
import { abrirEnlace, datosDelAviso, nombreDelMedico } from '@/lib/reserva/puertaReserva'
import MarcoPublico from '@/components/agendaPublica/MarcoPublico'

/* ═══ /reservar/[codigo]/privacidad — AVISO INTEGRAL DEL CONSULTORIO ═══
   (privacidad 2026-12, documento 2). Pública y sin sesión, como su vecina
   `/reservar/[codigo]`: la cubre el MISMO `startsWith('/reservar/')` del
   middleware, no llama a getUser() y no redirige. Su puerta es la misma
   `abrirEnlace`: cualquier causa de no abrir —no existe, revocado, pausado,
   interruptor apagado, aviso sin aprobar, clínica sin acceso, consultorio sin
   dirección o sin teléfono— da el MISMO notFound().

   SÓLO LEE, y sólo pinta el texto aprobado con el médico, el consultorio
   principal, su dirección y el teléfono de contacto: lo mismo que ya enseña
   la página de reserva. Un enlace único usado o caducado sigue mostrando el
   aviso: quien reservó con él tiene que poder volver a leerlo.

   Siempre en claro (tanda H) y `no-referrer`: el código va en la URL. */

export const metadata: Metadata = {
  title: 'Aviso de privacidad del consultorio · Spinus',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#163250' }

/** Lo que viene de la base entra como TEXTO: sin esto, un «*» o un «[» de una dirección sería Markdown. */
function comoTexto(valor: string): string {
  return valor.replace(/[\\`*_{}[\]()#+\-.!<>&|~]/g, c => `\\${c}`)
}

export default async function Page({ params }: PageProps<'/reservar/[codigo]/privacidad'>): Promise<ReactElement> {
  const { codigo } = await params
  const enlace = await abrirEnlace(codigo)
  const delAviso = enlace ? datosDelAviso(enlace.ctx) : null
  if (!enlace || !delAviso) notFound()
  const medico = nombreDelMedico(enlace.ctx)
  const texto = textoAviso({
    medico: comoTexto(medico), consultorio: comoTexto(delAviso.consultorio), direccion: comoTexto(delAviso.direccion),
    telefono: comoTexto(delAviso.telefono), url: '',
  }, AVISO_INTEGRAL_PLANTILLA.replace('{FECHA}', AVISO_INTEGRAL_FECHA))
  return (
    <MarcoPublico medico={{ nombre: medico }}>
      <article className="rp-tarjeta rp-legal" data-aviso-integral>
        <ReactMarkdown disallowedElements={['a', 'img']} unwrapDisallowed>{texto}</ReactMarkdown>
      </article>
    </MarcoPublico>
  )
}
