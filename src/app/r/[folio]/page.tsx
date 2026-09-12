import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ExternalLink, Lock, ShieldAlert } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { PREFIJO_POR_CLASE, normalizarFolio, type ClaseFolio } from '@/lib/documentos/folio'
import Cedulas from './Cedulas'
import './verificacion.css'

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

/* ⚠️ EL ACENTO DEL CONSULTORIO NO SE APLICA AQUÍ, Y ES DELIBERADO.
   `contenido` trae `color_primario` y `color_secundario` —el papel se imprime
   con ellos— y esta página los ignora: el cromo es de Spinus. Un acento libre
   podría caer cerca del verde de «verificado» o del rojo de «el papel fue
   alterado», que en esta página son SEMÁNTICOS y no decorativos, y teñir la
   declaración con el color que eligió el propio emisor debilita justo lo que la
   declaración afirma. Todo el color vive en `verificacion.css`. */

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
  }
}

/**
 * El símbolo y el nombre. El símbolo YA TRAE SU PROPIO DISCO dibujado, así que
 * no se recorta en círculo ni se le añade sombra: hacerlo le comería el anillo.
 * Va con `alt=""` porque «Spinus» está a su lado como texto — anunciarlo dos
 * veces es ruido para quien escucha la página.
 */
function BarraDeMarca(): ReactElement {
  return (
    <header className="vf-marca">
      <div className="vf-marca__in">
        <Image
          src="/logo-spinus.png"
          alt=""
          width={800}
          height={777}
          sizes="26px"
          loading="eager"
          className="vf-marca__simbolo"
        />
        <span className="vf-marca__nombre">Spinus</span>
        <span className="vf-marca__rol">
          <span className="vf-marca__rol--corto">Verificación</span>
          <span className="vf-marca__rol--ancho">Verificación pública de documentos</span>
        </span>
      </div>
    </header>
  )
}

/** Marco común: misma barra, misma columna y mismo pie en los dos desenlaces. */
function Hoja({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <div className="vf-root">
      <BarraDeMarca />
      <div className="vf-col">
        {children}
        <footer className="vf-pie">
          <p className="vf-pie__texto">
            Esta página es el respaldo del médico: muestra exactamente lo que se emitió, para
            cotejarlo contra el papel. No hace referencia al paciente — quien escanea ya tiene el
            documento delante.
          </p>
          <Link href="/" className="vf-pie__enlace">Conoce Spinus</Link>
          <p className="vf-pie__marca">Spinus · Sistema de Gestión Clínica · spinus.com.mx</p>
        </footer>
      </div>
    </div>
  )
}

/**
 * El desenlace negativo. Responde 200 y no `notFound()`: «este folio no
 * verifica» es una respuesta con significado para quien escanea, no una página
 * que falta, y así conserva la estética en vez de caer al 404 pelado de Next.
 *
 * Reusa la caja de la declaración sin su verde —`--nulo`— para que los dos
 * desenlaces pesen lo mismo. Y NO lleva medicamentos: ver la cabecera.
 */
function NoVerificado(): ReactElement {
  return (
    <Hoja>
      <section className="vf-decl vf-decl--nulo">
        <ShieldAlert className="vf-decl__icono" strokeWidth={2.5} aria-hidden="true" />
        <div className="vf-decl__col">
          <p className="vf-decl__ante">Sin verificar</p>
          <h1 className="vf-decl__frase">No pudimos verificar este documento</h1>
          <p className="vf-decl__cuerpo">
            El folio no corresponde a ningún documento verificable.
          </p>
        </div>
      </section>

      <section className="vf-caja">
        <p>
          Compruebe que el folio esté completo y bien escrito. Los folios verificables tienen la
          forma <b>RX-2026-0001</b>: tres o cuatro letras, el año y el número.
        </p>
        <p>
          Los documentos emitidos antes de que existiera esta serie ya no se verifican en línea. Si
          necesita confirmar uno de ellos, contacte directamente al consultorio que lo emitió.
        </p>
        {/* Sin fila no hay nada que respaldar, y por eso este desenlace no
            compone lista: ver la cabecera. */}
        <p className="vf-caja__menor">
          Sin un documento que la respalde no hay lista de medicamentos que mostrar.
        </p>
      </section>
    </Hoja>
  )
}

/**
 * Un renglón de la lista, con los cinco campos y su ordinal.
 *
 * El ordinal va `aria-hidden`: la lista es un `<ol>` y quien la escucha ya
 * recibe el número por la semántica; pintarlo además en el distintivo es para
 * el ojo que recorre el papel de arriba abajo buscando el renglón que sobra.
 *
 * Las indicaciones van en bloque propio, a ancho completo, respetando los saltos
 * que escribió el médico y sin recorte: ver la cabecera.
 */
function Renglon({ med, indice }: { med: MedicamentoPublicado; indice: number }): ReactElement {
  return (
    <li className="vf-med">
      <span className="vf-med__ord" aria-hidden="true">{indice}</span>

      <div className="vf-med__id">
        <p className="vf-med__nombre">{med.nombreComercial}</p>
        {med.principioActivo !== undefined && (
          <p className="vf-med__activo">
            Principio activo: <b>{med.principioActivo}</b>
          </p>
        )}
      </div>

      {(med.presentacion !== undefined || med.via !== undefined) && (
        <div className="vf-med__pares">
          {med.presentacion !== undefined && (
            <div className="vf-med__campo">
              <span className="vf-med__et">Presentación</span>
              <span className="vf-med__valor">{med.presentacion}</span>
            </div>
          )}
          {med.via !== undefined && (
            <div className="vf-med__campo">
              <span className="vf-med__et">Vía</span>
              <span className="vf-med__valor vf-med__valor--via">{med.via}</span>
            </div>
          )}
        </div>
      )}

      {med.indicaciones !== undefined && (
        <div className="vf-med__ind">
          <span className="vf-med__et">Indicaciones</span>
          <p>{med.indicaciones}</p>
        </div>
      )}
    </li>
  )
}

/**
 * La lista entera. Es el producto de esta página: ver la cabecera.
 *
 * ⚠️ EL CONTADOR DE LA CABECERA DICE «{n} de {n}» CON EL MISMO NÚMERO DOS VECES,
 * y no es una errata: afirma que se están mostrando los n renglones de los n que
 * se emitieron, o sea que la lista NO se plegó, NO paginó y NO se recortó. Es la
 * mitad de arriba del sistema; la otra es el ordinal de cada renglón. Recortar
 * la lista volvería mentiroso el contador.
 */
function Medicamentos(
  { medicamentos }: { medicamentos: readonly MedicamentoPublicado[] },
): ReactElement {
  const total = medicamentos.length
  return (
    <section className="vf-meds">
      <div className="vf-meds__cab">
        <div className="vf-meds__fila">
          <h2 className="vf-meds__et">Medicamentos emitidos</h2>
          <span className="vf-meds__contador">{total} de {total}</span>
        </div>
        <p className="vf-meds__aviso">
          Esto es exactamente lo que se emitió. Si el papel dice otra presentación, otras
          indicaciones o tiene un renglón de más,{' '}
          <span className="vf-meds__alerta">el papel fue alterado</span>.
        </p>
      </div>

      <ol className="vf-meds__lista">
        {medicamentos.map((med, i) => (
          <Renglon key={`${i}-${med.nombreComercial}`} med={med} indice={i + 1} />
        ))}
      </ol>

      <p className="vf-meds__nota">
        Las indicaciones son el texto que escribió el médico al emitir la receta. Esta página no
        registra si ya se surtió.
      </p>
    </section>
  )
}

export default async function VerificacionPage(
  { params }: { params: Promise<{ folio: string }> },
): Promise<ReactElement> {
  const { folio } = await params
  const doc = await leerDocumento(folio)

  if (doc === null) return <NoVerificado />

  const hayCedulas = doc.cedulaProfesional !== undefined || doc.cedulaEspecialidad !== undefined

  return (
    <Hoja>
      {/* La declaración: es el producto de esta página, y por eso abre. */}
      <section className="vf-decl">
        <Check className="vf-decl__icono" strokeWidth={3} aria-hidden="true" />
        <div className="vf-decl__col">
          <p className="vf-decl__ante">Documento verificado</p>
          <h1 className="vf-decl__frase">Este documento es auténtico</h1>
          <p className="vf-decl__cuerpo">
            Existe en el registro de Spinus y fue emitido por el médico que aparece abajo. Coteje
            estos datos con el papel que tiene delante.
          </p>
        </div>
      </section>

      {/* SEGUNDO, y antes del médico: folio y fecha son los dos datos con los
          que se coteja de un vistazo. Aquí vivía además la card del paciente por
          iniciales; se retiró entera —ver la cabecera— y no vuelve. */}
      <section className="vf-datos">
        <div className="vf-dato">
          <span className="vf-dato__et">Folio</span>
          <p className="vf-dato__folio">{doc.folio}</p>
          <p className="vf-dato__pista">{doc.etiqueta} · Debe coincidir con el folio impreso.</p>
        </div>
        <div className="vf-dato">
          <span className="vf-dato__et">Fecha de emisión</span>
          <p className="vf-dato__fecha">{doc.fecha}</p>
        </div>
      </section>

      {/* Quién lo firma: es justo lo que hay que poder comprobar, así que va
          completo y es la única tarjeta con acento. */}
      <section className="vf-medico">
        <div className="vf-medico__id">
          <p className="vf-medico__ante">Emitido por</p>
          <p className="vf-medico__nombre">{doc.medicoNombre}</p>
          {doc.medicoEspecialidad !== undefined && (
            <p className="vf-medico__esp">{doc.medicoEspecialidad}</p>
          )}
        </div>

        {/* Sin ninguna cédula no se compone ni la caja ni el enlace: no habría
            nada que comprobar allá. */}
        {hayCedulas && (
          <>
            <Cedulas
              cedulaProfesional={doc.cedulaProfesional}
              cedulaEspecialidad={doc.cedulaEspecialidad}
            />

            <div className="vf-registro">
              <div className="vf-registro__texto">
                <p className="vf-registro__lead">
                  Compruébelo usted mismo en el registro del gobierno: busque por número de cédula.
                </p>
                <p className="vf-registro__nota">
                  Registro Nacional de Profesionistas (SEP). Único dominio oficial: termina en
                  gob.mx. Pegue el número de cédula en el buscador.
                </p>
              </div>

              <div className="vf-registro__accion">
                <a
                  href={BUSCADOR_CEDULAS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vf-registro__boton"
                >
                  <ExternalLink className="vf-registro__icono" aria-hidden="true" />
                  <span className="vf-registro__rotulo--largo">Abrir el registro de la SEP</span>
                  <span className="vf-registro__rotulo--corto">Abrir el registro</span>
                </a>
                {/* El host IMPRESO, nunca como título emergente: ver la nota de
                    `verificacion.css`. El orden visual lo pone el CSS. */}
                <span className="vf-registro__host">
                  <Lock className="vf-registro__candado" aria-hidden="true" />
                  <span>
                    cedulaprofesional.sep.<span className="vf-registro__gob">gob.mx</span>
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Sin renglones el bloque no se compone: son los ocho formatos que no son
          Receta, que no guardan la clave. */}
      {doc.medicamentos.length > 0 && <Medicamentos medicamentos={doc.medicamentos} />}
    </Hoja>
  )
}
