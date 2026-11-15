import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { notFound } from 'next/navigation'
import { AVISO_CASILLA, textoAviso } from '@/lib/reserva/avisoReserva'
import { abrirEnlace, nombreDelMedico, telefonoDeContacto } from '@/lib/reserva/puertaReserva'
import { resolverEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { fechaHoraEnZona } from '@/lib/reserva/correosReserva'
import { esCodigoDeEnlace } from '@/lib/reserva/secretos'
import { cierraLaPagina, motivosApertura } from '@/lib/reserva/aperturaEnlace'
import type { EnlaceAbierto } from '@/lib/reserva/puertaReserva'
import ReservaCliente, { type DatosPagina } from './ReservaCliente'
import MarcoPublico from '@/components/agendaPublica/MarcoPublico'

/* ═══ /reservar/[codigo] — RESERVA POR ENLACE (agenda D5) ═══
   Pública y sin sesión. NO llama a getUser() ni redirige a ningún sitio: la
   puerta es el código del enlace (`abrirEnlace`), y cualquier causa de no
   abrir —no existe, revocado, interruptor apagado, aviso sin aprobar o con
   la marca de pendiente, clínica sin acceso, médico que ya no está, sin
   RESERVA_SECRETO, migraciones ausentes— da el MISMO notFound().

   ⚠️ AL NAVEGADOR SÓLO VA LO QUE LA PÁGINA PINTA: médico, especialidad,
   consultorios con dirección y teléfono, tipos con su duración y el aviso
   ya rellenado. NUNCA clinica_id, enlace_id, medico_id, el horario crudo ni
   el nombre de la clínica (lista A, 24). Los turnos se piden a la API.

   El código va en la URL: `referrer: 'no-referrer'` para que no salga a
   terceros, y `noindex`. Sin localStorage. */

export const metadata: Metadata = {
  title: 'Reservar cita · Spinus®',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

/** Usado o caducado (y sin consultorio o sin tipos): sólo la marca, sin el médico, como antes. */
function NoDisponible({ telefono }: { telefono: string | null }): ReactElement {
  return (
    <MarcoPublico>
      <div className="rp-tarjeta">
        <div className="rp-exito">
          <span className="rp-exito__icono rp-exito__icono--neutro" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></svg>
          </span>
          <h1 className="rp-titulo">Este enlace ya no está disponible</h1>
          <p className="rp-sub">
            {telefono ? <>Para agendar, comunícate con el consultorio: <strong style={{ color: 'var(--ag-ink)' }}>{telefono}</strong>.</> : 'Para agendar, comunícate con el consultorio.'}
          </p>
          {telefono && <a className="rp-btn rp-btn--sec" href={`tel:${telefono.replace(/[^0-9+]/g, '')}`}>Llamar al consultorio</a>}
        </div>
      </div>
    </MarcoPublico>
  )
}

/**
 * E6: `?origen=` es el código de confirmación de la cita que la persona canceló
 * y quiere reagendar. Sólo se toma si ese enlace existe, está cancelado por el
 * paciente y es de la MISMA clínica; si no, se ignora y la reserva es normal.
 * Sólo lee (STABLE). La base vuelve a validarlo todo al reservar.
 */
async function origenDe(valor: string | string[] | undefined, enlace: EnlaceAbierto): Promise<DatosPagina['origen']> {
  if (typeof valor !== 'string' || !esCodigoDeEnlace(valor)) return null
  const c = await resolverEnlaceConfirmacion(valor)
  if (!c || c.clinica_id !== enlace.ctx.clinica_id || c.estado !== 'cancelada' || c.respuesta !== 'cancelo') return null
  return { codigo: valor, cuando: fechaHoraEnZona(c.inicio, c.zona ?? 'America/Mexico_City') }
}

export default async function Page({ params, searchParams }: PageProps<'/reservar/[codigo]'>): Promise<ReactElement> {
  const { codigo } = await params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) notFound()
  const { ctx } = enlace
  /* La MISMA regla con la que la pantalla de configuración marca el enlace que
     no abrirá (tanda T2, punto 8): usado, caducado, sin consultorio o sin
     tipos. Hacia el paciente, el mensaje es siempre el genérico. */
  const motivos = motivosApertura({
    estado: ctx.estado, consultorios: ctx.consultorios, tipos: ctx.tipos.length, horarioClinica: ctx.clinica?.horario ?? null,
  })
  if (motivos.some(cierraLaPagina)) return <NoDisponible telefono={telefonoDeContacto(ctx)} />

  const medico = nombreDelMedico(ctx)
  const principal = ctx.consultorios[0]
  const datos: DatosPagina = {
    codigo,
    clase: ctx.clase,
    medico,
    especialidad: ctx.medico.especialidad,
    consultorios: ctx.consultorios.map(c => ({ id: c.id, nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, zona: c.timezone })),
    tipos: ctx.tipos.map(t => ({ id: t.id, nombre: t.nombre, duracionMin: t.duracion_min })),
    aviso: textoAviso({
      medico,
      consultorio: principal?.nombre ?? '',
      direccion: principal?.direccion ?? '',
      telefono: telefonoDeContacto(ctx) ?? '',
      url: '',
    }),
    casilla: AVISO_CASILLA,
    origen: ctx.clase === 'fijo' ? await origenDe((await searchParams).origen, enlace) : null,
  }
  return <MarcoPublico medico={{ nombre: medico, especialidad: ctx.medico.especialidad }}><ReservaCliente datos={datos} /></MarcoPublico>
}
