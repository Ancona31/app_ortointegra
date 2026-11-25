import type { Metadata, Viewport } from 'next'
import type { ReactElement } from 'react'
import { notFound } from 'next/navigation'
import { resolverEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { ofertaReagendar, type OfertaReagendar } from '@/lib/confirmacion/reagendarConfirmacion'
import {
  citaPintada, comunicate, esPasoCancelar, esPasoConfirmar, leerResultado, mensajeDeResultado, textoDeEstado,
  type CitaPintada, type ResultadoPagina,
} from '@/lib/confirmacion/vistaConfirmacion'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import MarcoPublico from '@/components/agendaPublica/MarcoPublico'
import ConfirmarAlCargar from './ConfirmarAlCargar'

/* ═══ /confirmar/[codigo] — CONFIRMACIÓN DE ASISTENCIA (agenda E3) ═══
   Pública y sin sesión. NO llama a getUser() ni redirige.

   ⚠️ ESTA PÁGINA NUNCA ESCRIBE NADA. Ni «visto», ni límites, ni la
   respuesta: sólo lee (`cita_confirmacion_contexto`, STABLE). Los filtros de
   correo y la vista previa de WhatsApp abren los enlaces solos; si el GET
   escribiera, las citas se confirmarían o cancelarían sin que nadie lo
   pidiera. El estado cambia SÓLO con el POST de los botones
   (`/api/confirmar/[codigo]`). «No podré asistir» es otro GET
   (`?paso=cancelar`) que sólo pinta el «¿Seguro?» con su propio formulario.
   K2 (punto 8): `?paso=confirmar` (el botón «Confirmo mi asistencia» del
   correo) TAMPOCO escribe en el GET: pinta el mismo botón dentro de
   `ConfirmarAlCargar`, que en el navegador manda el POST del botón al
   cargarse. Sin JavaScript queda el botón.

   Cualquier causa de no abrir —código con mala forma o inexistente,
   revocado, interruptor apagado, clínica suspendida, paciente de la cita
   cambiado, sin RESERVA_SECRETO, migraciones ausentes— da el MISMO notFound().

   Cancelada por el paciente: se ofrece «Elegir otro horario» con el enlace
   fijo del médico (E6, `ofertaReagendar`: otra lectura STABLE), o el teléfono.

   ⚠️ AL HTML SÓLO VA LO QUE SE PINTA: fecha, hora y zona, médico, consultorio,
   dirección y teléfono. Nunca clinica_id, el hash ni ningún id; nada clínico.

   `referrer: 'same-origin'`, NO 'no-referrer' como /reservar: con
   'no-referrer' el navegador manda `Origin: null` en el POST del formulario
   (Fetch, «append a request Origin header») y la ruta lo rechazaría por
   origen. 'same-origin' tampoco deja salir el código a terceros.
   TEXTOS: PENDIENTES DE REVISIÓN (ver vistaConfirmacion.ts).

   Tanda G1: el lenguaje visual de la reserva (`MarcoPublico`, `--ag-*`;
   siempre en claro desde la tanda H). La fecha es lo más grande; cada estado y cada
   resultado tienen su color además de su texto. Los textos, los nombres de
   los botones y el orden de las puertas NO cambiaron. */

export const metadata: Metadata = {
  title: 'Tu cita',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
}

export const dynamic = 'force-dynamic'

/* Tanda H, punto 2: siempre en claro. `<meta name="color-scheme" content="light">`
   y la barra del navegador con el navy claro de la cabecera, aunque el sistema
   esté en oscuro (el `themeColor` del layout raíz tiene variante oscura). */
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#163250' }

/** El color de la nota según lo que dice: verde lo confirmado, rojo lo cancelado, ámbar lo que pide llamar. */
function claseDeEstado(estado: ContextoConfirmacion['estado']): string {
  if (estado === 'confirmada') return 'rp-nota rp-nota--ok'
  if (estado === 'cancelada') return 'rp-nota rp-nota--error'
  return 'rp-nota'
}
function claseDeResultado(r: ResultadoPagina): string {
  if (r === 'confirmada' || r === 'ya_confirmada') return 'rp-nota rp-nota--ok'
  if (r === 'fuera_de_plazo' || r === 'limite') return 'rp-nota rp-nota--atencion'
  return 'rp-nota'
}

/** Tras cancelar: «Elegir otro horario» (E6) o el teléfono. PENDIENTE DE REVISIÓN. */
function Reagendar({ oferta, telefono }: { oferta: OfertaReagendar | null; telefono: string | null }): ReactElement {
  if (oferta?.tipo === 'enlace') {
    return (
      <div className="rp-grupo">
        <p className="rp-sub">¿Quieres otra fecha? Puedes elegir un horario libre con el enlace de reserva del consultorio.</p>
        <a href={oferta.href} className="rp-btn">Elegir otro horario</a>
      </div>
    )
  }
  if (oferta?.tipo === 'ya_reagendada') return <p className="rp-sub">Ya elegiste otro horario para esta cita.</p>
  return <p className="rp-sub">Para agendar otra cita, {comunicate(telefono)}.</p>
}

function Formulario({ codigo, accion, texto, clase }: { codigo: string; accion: 'confirmar' | 'cancelar'; texto: string; clase: string }): ReactElement {
  return (
    <form method="post" action={`/api/confirmar/${codigo}`}>
      <input type="hidden" name="accion" value={accion} />
      <button type="submit" className={clase}>{texto}</button>
    </form>
  )
}

/** Fecha grande, consultorio con su dirección completa y teléfono (punto 2). Nada clínico. */
function TarjetaCita({ cita }: { cita: CitaPintada }): ReactElement {
  return (
    <>
      <div className="rp-grupo">
        <h1 className="rp-etiqueta" style={{ margin: 0 }}>Tu cita</h1>
        <p className="rp-fecha"><small>{cita.partes.dia}</small>{cita.partes.fecha}{cita.zona && <span>{cita.zona}</span>}</p>
      </div>
      {(cita.consultorio || cita.direccion || cita.telefono) && (
        <dl className="rp-resumen" aria-label="Dónde">
          {cita.consultorio && <><dt>Consultorio</dt><dd data-consultorio>{cita.consultorio}</dd></>}
          {cita.direccion && <><dt>Dirección</dt><dd data-direccion>{cita.direccion}</dd></>}
          {cita.telefono && <><dt>Teléfono</dt><dd>{cita.telefono}</dd></>}
        </dl>
      )}
    </>
  )
}

interface Acciones {
  codigo: string; ctx: ContextoConfirmacion; cita: CitaPintada; resultado: ResultadoPagina | null; oferta: OfertaReagendar | null
  /** K2 (punto 8): vino del botón del correo y aún se puede confirmar: el navegador confirma al cargar. */
  alCargar: boolean
}

function Botones({ codigo, ctx, cita, resultado, oferta, alCargar }: Acciones): ReactElement {
  const boton = <Formulario codigo={codigo} accion="confirmar" texto="Confirmo mi asistencia" clase="rp-btn" />
  return (
    <section className="rp-grupo" style={{ gap: 'var(--ag-3)' }}>
      {!resultado && <p className={claseDeEstado(ctx.estado)}>{textoDeEstado(ctx)}</p>}
      {ctx.puede_confirmar && (alCargar ? <ConfirmarAlCargar codigo={codigo}>{boton}</ConfirmarAlCargar> : boton)}
      {ctx.puede_cancelar && <a href={`/confirmar/${codigo}?paso=cancelar`} className="rp-btn rp-btn--sec">No podré asistir</a>}
      {!ctx.puede_cancelar && resultado !== 'fuera_de_plazo' && (ctx.estado === 'agendada' || ctx.estado === 'confirmada') && (
        <p className="rp-sub">Ya no es posible cancelar desde el enlace; {comunicate(cita.telefono)}.</p>
      )}
      {ctx.estado === 'cancelada' && <Reagendar oferta={oferta} telefono={cita.telefono} />}
    </section>
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
  const alCargar = esPasoConfirmar(consulta.paso) && ctx.puede_confirmar && !resultado
  const oferta = ctx.estado === 'cancelada' ? await ofertaReagendar(ctx, codigo) : null

  return (
    <MarcoPublico medico={cita.medico ? { nombre: cita.medico } : null}>
      <div className="rp-tarjeta">
        <div className="rp-paso">
          <TarjetaCita cita={cita} />
          {resultado && <p role="status" className={claseDeResultado(resultado)}>{mensajeDeResultado(resultado, cita.telefono)}</p>}
          {pidiendoCancelar ? (
            <section className="rp-grupo" style={{ gap: 'var(--ag-3)' }}>
              <p className="rp-nota rp-nota--atencion">¿Seguro que no podrás asistir? Se cancelará tu cita y se liberará tu horario.</p>
              <Formulario codigo={codigo} accion="cancelar" texto="Sí, cancelar mi cita" clase="rp-btn rp-btn--peligro" />
              <a href={`/confirmar/${codigo}`} className="rp-enlace">Volver</a>
            </section>
          ) : <Botones codigo={codigo} ctx={ctx} cita={cita} resultado={resultado} oferta={oferta} alCargar={alCargar} />}
        </div>
      </div>
    </MarcoPublico>
  )
}
