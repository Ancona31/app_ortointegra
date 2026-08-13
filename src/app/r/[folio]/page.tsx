import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { PREFIJO_POR_CLASE, normalizarFolio, type ClaseFolio } from '@/lib/documentos/folio'
import BotonCopiarCedula from './BotonCopiarCedula'

/* ═══ /r/[folio] — VERIFICACIÓN PÚBLICA DE AUTENTICIDAD ═══
   Esta página existe para UNA cosa: que quien tiene el papel delante —una
   farmacia, un hospital, una aseguradora— pueda cotejarlo renglón por renglón
   contra lo que se emitió de verdad.

   ⚠️⚠️ NO ES UN SERVICIO AL PACIENTE: ES EL RESPALDO DEL MÉDICO

   Un PDF se edita en cinco minutos. Alguien cambia una dosis o añade un
   renglón, y la firma del médico sigue ahí. Si esa receta acaba en un problema,
   lo único que el médico tiene para demostrar qué recetó de verdad es esta
   página. Por eso la lista de medicamentos se publica ENTERA.

   Y por eso mismo el paciente sale por completo —ni nombre, ni iniciales, ni
   referencia alguna—: sin él, lo publicado es una lista de fármacos que no se
   puede atribuir a nadie. La URL es adivinable —el folio va impreso dentro del
   QR y la serie es correlativa—, así que quien camine la serie recoge recetas
   anónimas y no expedientes. **No son dos decisiones sino una:** es esa
   sustracción la que hace publicable la lista. Reponer al paciente sin retirar
   los medicamentos rehace la fuga que este archivo corrigió.

   ⚠️ LO QUE SIGUE SIN PUBLICARSE: el diagnóstico y las recomendaciones. Un
   diagnóstico es dato personal SENSIBLE bajo la LFPDPPP vigente y las multas se
   duplican tratándose de ellos; además, unido a los fármacos volvería
   identificable lo que ahora no lo es.

   ⚠️ POR ESO `contenido` SIGUE SIN ATARSE A NINGUNA VARIABLE DE COMPONENTE. Se
   lee dentro de `leerDocumento()` y de ahí solo salen los campos de
   `Verificacion` —el puñado del encabezado, más los cinco de cada medicamento—.
   Si algún día ves `contenido` cruzando hacia el JSX, la fuga volvió.

   ⚠️ CINCO CAMPOS, LOS DEL FORMULARIO Y NINGUNO MÁS: nombre comercial,
   principio activo, presentación, vía de administración e indicaciones.
   Frecuencia, duración y cantidad NO son campos del formato: viven dentro de
   las indicaciones, en el texto libre que escribe el médico, y por eso se
   imprimen LITERALES —con sus saltos de línea y sin recortar—. Fabricar
   columnas analizando ese texto sería inventar dato.

   ⚠️ EL CONTADOR «{n} de {n}» DE CADA RENGLÓN NO ES DECORATIVO: es lo que
   delata un renglón añadido al papel. Por eso la lista no se pliega, no pagina
   y no lleva desplazamiento interno, tenga uno o tenga ocho.

   ⚠️ LA DEMO `/demo/receta` YA NO ES LA REFERENCIA DE POLÍTICA. Estrenó la
   minimización antes que esta página, y desde este pase va por detrás en las
   dos direcciones: enseña al paciente y le falta el enlace al registro de
   cédulas. Está anotada como QR-02 en `CLAUDE.md`. Manda esta página.

   SOLO LA FORMA NUEVA DEL FOLIO RESUELVE. `normalizarFolio()` acepta las nueve
   series de la columna —`RX-2026-0001`— y rechaza las tres formas viejas que
   viven dentro de `contenido` (`R-` + hex, `NOH-AAAAMMDD-SSSSS`,
   `COT-AAAAMMDD-SSSSS`). Que las viejas dejen de resolver es DELIBERADO: cada
   QR ya impreso es hoy una fuga, y dejar de servirlo es el arreglo.

   ⚠️ QUÉ QR LLEGA HASTA AQUÍ, Y CUÁL NO LLEGARÁ NUNCA

   El ÚNICO formato que imprime QR de verificación es **Receta**, y desde agosto
   de 2026 lo compone sobre el `RX-…` de la columna: es ese cambio el que hace
   que esta página vuelva a servir. Antes lo componía sobre el `R-a3f9…` de
   `contenido` y ninguno resolvía.

   Los otros OCHO no llevan QR, y no es un cableado a medias: Suplementación y
   Honorarios instancian el componente `ZonaQR` (2.R) y nadie les pasa código. Se
   quedan así. **No lo «completes»** — encender un QR es decidir que ese formato
   se verifica en público, y eso se decide por formato, no por tener el hueco.

   ⚠️ LAS RECETAS ANTERIORES A ESE CAMBIO NO VERIFICAN Y ASÍ SE QUEDA. Llevan
   impreso un `R-…` que `normalizarFolio()` rechaza. Es el arreglo, no el daño:
   cada uno de esos QR servía el contenido clínico entero a quien lo escaneara.

   ── LO QUE SE DECIDIÓ QUE ESTA PÁGINA **NO** HACE ──────────────────────────

   · **No hay estado «anulado».** Un documento emitido es inmutable, así que no
     hay nada que anular ni ningún estado que consultar aquí.
   · **El enlace no caduca.** Está impreso en un papel que puede consultarse años
     después. La vigencia de una receta la juzga quien la recibe, con la fecha de
     emisión —que esta página muestra— y el plazo reglamentario que le aplique.
     Eso no es trabajo de esta página.
   · **No registra el surtido.** Que una receta se haya despachado o no vive
     fuera de Spinus, y esta página no lo afirma ni lo niega: lo dice su pie.
   · **El desenlace negativo no lleva medicamentos.** Sin documento no hay nada
     que mostrar, y una lista compuesta dentro de un error sería contenido sin
     respaldo. Ver `NoVerificado()`.

   ── LAS CÉDULAS: ENLACE AL REGISTRO OFICIAL, Y POR QUÉ NO VA PRELLENADO ────

   Afirmar que el médico existe no es verificarlo: hay que poder comprobarlo en
   la fuente. Por eso las cédulas llevan al buscador de la SEP. **No admite
   prellenado por URL** —comprobado en el portal—, así que el número se copia con
   su botón y se pega allá; un enlace por cédula no serviría de nada, porque el
   destino es el mismo para las dos y lo que cambia es lo que se pega.

   ⚠️ EL DOMINIO VA A LA VISTA ANTES DE PULSAR, con `gob.mx` destacado, y eso es
   contenido de seguridad y no adorno: existen sitios que imitan al registro
   oficial. Mandar a ciegas a quien está verificando algo sería lo contrario de
   lo que esta página hace.

   SIN `®`: la marca está en trámite ante el IMPI (exp. 3594483) y §7·Global lo
   prohíbe en texto nuevo. */

export const metadata: Metadata = {
  title: 'Verificación de documento — Spinus',
  description: 'Comprobación de autenticidad de un documento clínico emitido con Spinus.',
  /* Una verificación no es contenido de búsqueda, y además indexarla dejaría en
     el buscador el rastro de qué médico emitió qué y cuándo. Cierra la mitad
     «noindex» de la deuda §11 de la landing. */
  robots: { index: false, follow: false },
}

const NAVY_POR_DEFECTO = '#1a3a5c'
const AZUL_POR_DEFECTO = '#1e5fa8'

/**
 * El buscador de cédulas de la SEP. Dirección confirmada contra el portal.
 *
 * Va sin parámetros y no admite ninguno: ver la nota de cabecera. Si algún día
 * se le añade uno, se comprueba en el portal antes —no se deduce— y se cambia
 * también el renglón que explica por qué hay que copiar y pegar.
 */
const BUSCADOR_CEDULAS = 'https://cedulaprofesional.sep.gob.mx/cedula'

/**
 * Qué documento es, dicho desde el PREFIJO del folio y no desde `documentos.tipo`.
 *
 * El prefijo es lo que el verificador tiene delante en el papel, y además
 * distingue lo que `tipo` no puede: Honorarios y Cotización comparten el tipo
 * `nota_honorarios` y no comparten serie. Tecleado como `Record<ClaseFolio, …>`
 * a propósito: si algún día se abre una décima clase de folio, esto deja de
 * compilar en vez de resolver a `undefined` en silencio.
 */
const ETIQUETA_POR_CLASE: Record<ClaseFolio, string> = {
  rx: 'Receta médica',
  noh: 'Nota de honorarios',
  cot: 'Cotización',
  ci: 'Consentimiento informado',
  lab: 'Solicitud de laboratorio',
  img: 'Solicitud de imagenología',
  sup: 'Plan de suplementación',
  int: 'Solicitud de internamiento',
  den: 'Denegación de consentimiento',
}

const ETIQUETA_POR_PREFIJO = new Map<string, string>(
  (Object.keys(ETIQUETA_POR_CLASE) as ClaseFolio[]).map(
    clase => [PREFIJO_POR_CLASE[clase], ETIQUETA_POR_CLASE[clase]],
  ),
)

/**
 * Un renglón de la receta, con los CINCO campos del formulario y ninguno más.
 * Ver la cabecera antes de añadir un sexto.
 */
interface MedicamentoPublicado {
  readonly nombreComercial: string
  readonly principioActivo?: string
  readonly presentacion?: string
  readonly via?: string
  readonly indicaciones?: string
}

/** Lo único que sale de la base hacia el render. Ver la cabecera. */
interface Verificacion {
  readonly folio: string
  readonly etiqueta: string
  readonly fecha: string
  readonly medicamentos: readonly MedicamentoPublicado[]
  readonly medicoNombre: string
  readonly medicoEspecialidad?: string
  readonly cedulaProfesional?: string
  readonly cedulaEspecialidad?: string
  readonly navy: string
  readonly azul: string
}

interface FilaDocumento {
  readonly folio: string
  readonly created_at: string
  readonly subido_por: string | null
  readonly contenido: Record<string, unknown> | null
}

interface FilaPerfil {
  readonly titulo: string | null
  readonly nombres: string | null
  readonly apellido_paterno: string | null
  readonly apellido_materno: string | null
  readonly especialidad: string | null
  readonly cedula_profesional: string | null
  readonly cedula_especialidad: string | null
}

/** Cadena no vacía, ya recortada, o `undefined`. Nunca `''` hacia el render. */
function texto(fuente: Record<string, unknown> | null, clave: string): string | undefined {
  const valor = fuente?.[clave]
  if (typeof valor !== 'string') return undefined
  const limpio = valor.trim()
  return limpio === '' ? undefined : limpio
}

/**
 * Los medicamentos guardados en `contenido`, campo a campo y desconfiando de
 * todo: el jsonb pudo escribirse con otra versión del formulario.
 *
 * Solo la Receta guarda esta clave —los otros ocho formatos no la escriben—, así
 * que para ellos sale el arreglo vacío y el bloque entero no se compone.
 *
 * Un renglón sin nombre comercial se descarta porque no habría qué cotejar, y
 * eso NO descuadra el contador: `RecetaForm` filtra por `estaCompleto()` antes
 * de guardar, así que todo lo que llega aquí trae comercial y principio activo.
 */
function leerMedicamentos(contenido: Record<string, unknown> | null): MedicamentoPublicado[] {
  const bruto = contenido?.medicamentos
  if (!Array.isArray(bruto)) return []

  return bruto.flatMap((fila): MedicamentoPublicado[] => {
    if (typeof fila !== 'object' || fila === null) return []
    const campos = fila as Record<string, unknown>
    const nombreComercial = texto(campos, 'nombre_comercial')
    if (nombreComercial === undefined) return []
    return [{
      nombreComercial,
      principioActivo: texto(campos, 'principio_activo'),
      presentacion: texto(campos, 'presentacion'),
      via: texto(campos, 'via_administracion'),
      indicaciones: texto(campos, 'indicacion'),
    }]
  })
}

/**
 * La fecha que el papel lleva impresa (`contenido.fecha`, ISO), y el sello de la
 * fila como respaldo.
 *
 * El `T12:00:00` evita que una fecha sin hora se corra un día al cruzar husos.
 * El respaldo casi no actúa —solo resuelven folios de la serie nueva, y esos
 * siempre traen la fecha en ISO—, pero un documento sin fecha visible no se
 * puede cotejar, y ahí es mejor el sello de la fila que un guion.
 */
function fechaDeEmision(fechaISO: string | undefined, creadoEn: string): string {
  if (fechaISO !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
    return format(parseISO(`${fechaISO}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es })
  }
  return new Date(creadoEn).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * El único punto que toca la base. Devuelve `null` cuando no hay nada que
 * verificar —folio de forma vieja, folio inexistente o error— y esos tres casos
 * responden IGUAL a propósito: distinguirlos convertiría la página en un oráculo
 * que dice qué números de la serie están usados.
 *
 * Un borrador nunca llega aquí: la base le deja el folio en NULL hasta que se
 * emite (`20260812_documentos_estado.sql`), así que buscar por folio ya los
 * excluye. No se filtra por `estado` para no depender de una columna más de la
 * que esta página no necesita saber.
 */
async function leerDocumento(folioPedido: string): Promise<Verificacion | null> {
  const canonico = normalizarFolio(folioPedido)
  if (canonico === null) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('documentos')
    .select('folio, created_at, subido_por, contenido')
    .eq('folio', canonico)
    .maybeSingle<FilaDocumento>()

  if (error !== null || data === null) return null

  const contenido = data.contenido
  const prefijo = data.folio.split('-')[0] ?? ''

  /* El médico, con la instantánea del papel por delante del perfil de hoy. La
     receta guarda dentro de `contenido` el nombre y las cédulas con que se
     imprimió; los otros ocho no guardan ninguno y hay que ir al perfil de quien
     lo emitió. Cuando existe la instantánea manda ella: si el médico cambió de
     cédula después, lo que hay que cotejar es lo que dice el papel. */
  let medicoNombre = texto(contenido, 'medico_nombre')
  let medicoEspecialidad = texto(contenido, 'medico_especialidad')
  let cedulaProfesional = texto(contenido, 'medico_cedula_profesional')
  let cedulaEspecialidad = texto(contenido, 'medico_cedula_especialidad')

  if (medicoNombre === undefined && data.subido_por !== null) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('titulo, nombres, apellido_paterno, apellido_materno, especialidad, cedula_profesional, cedula_especialidad')
      .eq('id', data.subido_por)
      .maybeSingle<FilaPerfil>()

    if (perfil !== null) {
      medicoNombre = componerNombreMedicoCompleto(perfil).trim() || undefined
      medicoEspecialidad = perfil.especialidad?.trim() || undefined
      cedulaProfesional = perfil.cedula_profesional?.trim() || undefined
      cedulaEspecialidad = perfil.cedula_especialidad?.trim() || undefined
    }
  }

  return {
    folio: data.folio,
    etiqueta: ETIQUETA_POR_PREFIJO.get(prefijo) ?? 'Documento clínico',
    fecha: fechaDeEmision(texto(contenido, 'fecha'), data.created_at),
    medicamentos: leerMedicamentos(contenido),
    medicoNombre: medicoNombre ?? 'Médico no identificado',
    medicoEspecialidad,
    cedulaProfesional,
    cedulaEspecialidad,
    navy: texto(contenido, 'color_primario') ?? NAVY_POR_DEFECTO,
    azul: texto(contenido, 'color_secundario') ?? AZUL_POR_DEFECTO,
  }
}

/** Marco común: mismo fondo y misma columna en los dos desenlaces. */
function Hoja({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {children}
        <div className="text-center pb-4 space-y-2">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-4"
          >
            Conoce Spinus
          </Link>
          <p className="text-xs text-slate-300">
            Spinus · Sistema de Gestión Clínica · spinus.com.mx
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Un renglón de la lista. El contador va DENTRO del renglón —«2 de 3»— y no en
 * una cabecera con el total: pegado a cada fármaco es lo que permite recorrer el
 * papel de arriba abajo y descubrir dónde se metió el que sobra.
 *
 * Las indicaciones van en bloque propio, a ancho completo y con
 * `whitespace-pre-line`, porque son texto que escribió el médico: se imprimen
 * como las escribió, con sus saltos, sin recorte y sin analizarlas.
 */
function Renglon(
  { med, indice, total, azul }: {
    med: MedicamentoPublicado; indice: number; total: number; azul: string
  },
): ReactElement {
  return (
    <li className="px-5 py-4">
      <div className="flex items-baseline gap-3">
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px]
                         font-bold tabular-nums text-slate-500">
          {indice} de {total}
        </span>
        <p className="font-bold text-slate-800 text-base leading-tight">{med.nombreComercial}</p>
      </div>

      {med.principioActivo !== undefined && (
        <p className="text-sm mt-1" style={{ color: azul }}>{med.principioActivo}</p>
      )}

      {(med.presentacion !== undefined || med.via !== undefined) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-slate-500">
          {med.presentacion !== undefined && (
            <span><span className="font-semibold text-slate-600">Presentación:</span> {med.presentacion}</span>
          )}
          {med.via !== undefined && (
            <span><span className="font-semibold text-slate-600">Vía:</span> {med.via}</span>
          )}
        </div>
      )}

      {med.indicaciones !== undefined && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Indicaciones
          </span>
          <p className="text-sm text-slate-700 mt-0.5 leading-relaxed whitespace-pre-line">
            {med.indicaciones}
          </p>
        </div>
      )}
    </li>
  )
}

/**
 * La lista entera. Es el producto de esta página: ver la cabecera.
 *
 * ⚠️ NO SE PLIEGA, NO PAGINA Y NO LLEVA DESPLAZAMIENTO INTERNO. Una lista
 * recortada a las tres primeras deja de servir para lo único que sirve —contar
 * los renglones del papel— y volvería mentiroso el contador de cada renglón.
 */
function Medicamentos(
  { medicamentos, azul }: { medicamentos: readonly MedicamentoPublicado[]; azul: string },
): ReactElement {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Medicamentos emitidos
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mt-2">
          Esto es exactamente lo que se emitió. Si el papel dice otra presentación, otras
          indicaciones o tiene un renglón de más,{' '}
          <span className="font-bold text-slate-900">el papel fue alterado</span>.
        </p>
      </div>

      <ol className="border-t border-slate-100 divide-y divide-slate-100">
        {medicamentos.map((med, i) => (
          <Renglon
            key={`${i}-${med.nombreComercial}`}
            med={med}
            indice={i + 1}
            total={medicamentos.length}
            azul={azul}
          />
        ))}
      </ol>

      <p className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
        Las indicaciones son el texto que escribió el médico al emitir la receta. Esta página no
        registra si ya se surtió.
      </p>
    </div>
  )
}

/**
 * El desenlace negativo. Responde 200 y no `notFound()`: «este folio no
 * verifica» es una respuesta con significado para quien escanea, no una página
 * que falta, y así conserva la estética en vez de caer al 404 pelado de Next.
 */
function NoVerificado(): ReactElement {
  return (
    <Hoja>
      <div className="rounded-2xl p-5 flex items-center gap-4 bg-white border border-slate-200 shadow-sm">
        <ShieldAlert size={40} className="flex-shrink-0 text-slate-400" />
        <div>
          <p className="font-bold text-lg leading-tight text-slate-800">
            No pudimos verificar este documento
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            El folio no corresponde a ningún documento verificable.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Comprueba que el folio esté completo y bien escrito. Los folios verificables tienen la
          forma <span className="font-semibold text-slate-800">RX-2026-0001</span>: tres o cuatro
          letras, el año y el número.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Los documentos emitidos antes de que existiera esta serie ya no se verifican en línea. Si
          necesitas confirmar uno de ellos, contacta directamente al consultorio que lo emitió.
        </p>
        {/* Sin fila no hay nada que respaldar, y por eso este desenlace no
            compone lista: ver la cabecera. */}
        <p className="text-xs text-slate-400 leading-relaxed">
          Sin un documento que la respalde no hay lista de medicamentos que mostrar.
        </p>
      </div>
    </Hoja>
  )
}

export default async function VerificacionPage(
  { params }: { params: Promise<{ folio: string }> },
): Promise<ReactElement> {
  const { folio } = await params
  const doc = await leerDocumento(folio)

  if (doc === null) return <NoVerificado />

  return (
    <Hoja>
      {/* Sello de verificación */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${doc.navy}, ${doc.azul})` }}
      >
        <ShieldCheck size={40} className="flex-shrink-0 opacity-90" />
        <div>
          <p className="font-bold text-lg leading-tight">Documento verificado</p>
          <p className="text-sm opacity-80 mt-0.5">
            {doc.etiqueta} · Folio {doc.folio}
          </p>
        </div>
        <CheckCircle size={28} className="ml-auto flex-shrink-0 opacity-80" />
      </div>

      {/* Quién lo firma: es justo lo que hay que poder comprobar, así que va completo. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-3 border-b border-slate-100"
          style={{ borderLeftWidth: 4, borderLeftColor: doc.navy }}
        >
          <p className="font-bold text-slate-800 text-base">{doc.medicoNombre}</p>
          {doc.medicoEspecialidad !== undefined && (
            <p className="text-sm italic mt-0.5" style={{ color: doc.azul }}>
              {doc.medicoEspecialidad}
            </p>
          )}
        </div>
        <div className="px-5 py-3 space-y-3">
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            {doc.cedulaProfesional !== undefined && (
              <span>
                <span className="font-semibold text-slate-600">Cédula Prof.:</span>{' '}
                {doc.cedulaProfesional}
                <BotonCopiarCedula valor={doc.cedulaProfesional} que="Cédula profesional" />
              </span>
            )}
            {doc.cedulaEspecialidad !== undefined && (
              <span>
                <span className="font-semibold text-slate-600">Cédula Esp.:</span>{' '}
                {doc.cedulaEspecialidad}
                <BotonCopiarCedula valor={doc.cedulaEspecialidad} que="Cédula de especialidad" />
              </span>
            )}
          </div>

          {/* UN SOLO ENLACE PARA LAS CÉDULAS, y va aquí —pegado a los números—
              porque es una acción sobre ese dato, no un pie de página. El
              destino es el mismo para las dos; lo que cambia es qué se pega, y
              de eso se encarga el botón de cada una.

              El dominio se compone VISIBLE y partido para que `gob.mx` se lea
              como lo que es: ver la nota de cabecera sobre los sitios que imitan
              al registro. Sin ninguna cédula el bloque no se compone — no habría
              nada que comprobar allá. */}
          {(doc.cedulaProfesional !== undefined || doc.cedulaEspecialidad !== undefined) && (
            <div className="space-y-1.5">
              <a
                href={BUSCADOR_CEDULAS}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5
                           text-xs text-slate-500 hover:text-slate-700"
              >
                <ExternalLink size={13} className="flex-shrink-0 self-center" aria-hidden="true" />
                <span className="font-semibold text-slate-600 group-hover:text-slate-800">
                  Comprueba estas cédulas en el registro oficial
                </span>
                <span className="font-mono text-slate-400 group-hover:text-slate-600">
                  cedulaprofesional.sep.<span className="font-bold text-slate-600">gob.mx</span>
                </span>
              </a>
              <p className="text-xs text-slate-400 leading-relaxed">
                El registro no recibe el número por enlace: cópialo con su botón y pégalo en el
                buscador.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cuándo se emitió. Aquí vivía también la card del paciente por
          iniciales; se retiró entera —ver la cabecera— y no vuelve. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Fecha de emisión
        </span>
        <p className="font-medium text-slate-800 mt-0.5">{doc.fecha}</p>
      </div>

      {/* Sin renglones el bloque no se compone: son los ocho formatos que no son
          Receta, que no guardan la clave. */}
      {doc.medicamentos.length > 0 && (
        <Medicamentos medicamentos={doc.medicamentos} azul={doc.azul} />
      )}

      {/* La declaración: es el producto de esta página. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">
            Este documento fue emitido con Spinus y es auténtico.
          </span>{' '}
          Esta página es el respaldo del médico: muestra exactamente lo que se emitió, para
          cotejarlo contra el papel. No hace referencia al paciente — quien escanea ya tiene el
          documento delante.
        </p>
      </div>
    </Hoja>
  )
}
