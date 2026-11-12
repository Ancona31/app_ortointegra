import type { Metadata } from 'next'
import type { ReactElement, ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { resolverEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import {
  citaPintada, comunicate, esPasoCancelar, leerResultado, mensajeDeResultado, textoDeEstado,
} from '@/lib/confirmacion/vistaConfirmacion'

/* ═══ /confirmar/[codigo] — CONFIRMACIÓN DE ASISTENCIA (agenda E3) ═══
   Pública y sin sesión. NO llama a getUser() ni redirige.

   ⚠️ ESTA PÁGINA NUNCA ESCRIBE NADA. Ni «visto», ni límites, ni la
   respuesta: sólo lee (`cita_confirmacion_contexto`, STABLE). Los filtros de
   correo y la vista previa de WhatsApp abren los enlaces solos; si el GET
   escribiera, las citas se confirmarían o cancelarían sin que nadie lo
   pidiera. El estado cambia SÓLO con el POST de los botones
   (`/api/confirmar/[codigo]`). «No podré asistir» es otro GET
   (`?paso=cancelar`) que sólo pinta el «¿Seguro?» con su propio formulario.

   Cualquier causa de no abrir —código con mala forma o inexistente,
   revocado, interruptor apagado, clínica suspendida, paciente de la cita
   cambiado, sin RESERVA_SECRETO, migraciones ausentes— da el MISMO notFound().

   ⚠️ AL HTML SÓLO VA LO QUE SE PINTA: fecha, hora y zona, médico, consultorio,
   dirección y teléfono. Nunca clinica_id, el hash ni ningún id; nada clínico.

   `referrer: 'same-origin'`, NO 'no-referrer' como /reservar: con
   'no-referrer' el navegador manda `Origin: null` en el POST del formulario
   (Fetch, «append a request Origin header») y la ruta lo rechazaría por
   origen. 'same-origin' tampoco deja salir el código a terceros.
   TEXTOS: PENDIENTES DE REVISIÓN (ver vistaConfirmacion.ts). */

export const metadata: Metadata = {
  title: 'Tu cita',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
}

export const dynamic = 'force-dynamic'

const BOTON = 'w-full rounded-lg px-4 py-3 text-base font-medium'

function Marco({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className="min-h-screen bg-[#f0f4f8] px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6">{children}</div>
    </main>
  )
}

function Formulario({ codigo, accion, texto, clase }: { codigo: string; accion: 'confirmar' | 'cancelar'; texto: string; clase: string }): ReactElement {
  return (
    <form method="post" action={`/api/confirmar/${codigo}`}>
      <input type="hidden" name="accion" value={accion} />
      <button type="submit" className={`${BOTON} ${clase}`}>{texto}</button>
    </form>
  )
}

export default async function Page({ params, searchParams }: PageProps<'/confirmar/[codigo]'>): Promise<ReactElement> {
  const { codigo } = await params
  const ctx = await resolverEnlaceConfirmacion(codigo)
  if (!ctx) notFound()
  const consulta = await searchParams
  const resultado = leerResultado(consulta.r)
  const cita = citaPintada(ctx)
  const pidiendoCancelar = esPasoCancelar(consulta.paso) && ctx.puede_cancelar

  return (
    <Marco>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-800">Tu cita</h1>
        <p className="text-slate-700"><span className="capitalize">{cita.cuando}</span>{cita.zona ? ` ${cita.zona}` : ''}</p>
        {cita.medico && <p className="text-sm text-slate-600">Con: {cita.medico}</p>}
        {cita.consultorio && <p className="text-sm text-slate-600">En: {cita.consultorio}{cita.direccion ? `, ${cita.direccion}` : ''}</p>}
        {cita.telefono && <p className="text-sm text-slate-600">Teléfono del consultorio: {cita.telefono}</p>}
      </header>

      {resultado && <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">{mensajeDeResultado(resultado, cita.telefono)}</p>}

      {pidiendoCancelar ? (
        <section className="space-y-3">
          <p className="text-slate-700">¿Seguro que no podrás asistir? Se cancelará tu cita y se liberará tu horario.</p>
          <Formulario codigo={codigo} accion="cancelar" texto="Sí, cancelar mi cita" clase="bg-red-600 text-white" />
          <a href={`/confirmar/${codigo}`} className="block text-center text-sm text-[#1e5fa8]">Volver</a>
        </section>
      ) : (
        <section className="space-y-3">
          {!resultado && <p className="text-slate-700">{textoDeEstado(ctx)}</p>}
          {ctx.puede_confirmar && <Formulario codigo={codigo} accion="confirmar" texto="Confirmo mi asistencia" clase="bg-[#1e5fa8] text-white" />}
          {ctx.puede_cancelar && (
            <a href={`/confirmar/${codigo}?paso=cancelar`} className={`${BOTON} block border border-slate-300 text-center text-slate-700`}>No podré asistir</a>
          )}
          {!ctx.puede_cancelar && resultado !== 'fuera_de_plazo' && (ctx.estado === 'agendada' || ctx.estado === 'confirmada') && (
            <p className="text-sm text-slate-600">Ya no es posible cancelar desde el enlace; {comunicate(cita.telefono)}.</p>
          )}
          {ctx.estado === 'cancelada' && (
            <p className="text-sm text-slate-600">Para agendar otra cita, {comunicate(cita.telefono)}.</p>
          )}
        </section>
      )}
    </Marco>
  )
}
