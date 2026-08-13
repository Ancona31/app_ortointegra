import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { PREFIJO_POR_CLASE, normalizarFolio, type ClaseFolio } from '@/lib/documentos/folio'

/* ═══ /r/[folio] — VERIFICACIÓN PÚBLICA DE AUTENTICIDAD ═══
   Esta página existe para UNA cosa: que quien tiene el papel delante —una
   farmacia, un hospital, una aseguradora— pueda comprobar que el documento lo
   emitió Spinus y quién lo firmó. **No es un visor del documento.** Lo que dice
   el papel ya lo tiene quien escanea; lo que no puede saber es si es auténtico.

   ⚠️⚠️ LO QUE ESTA PÁGINA NO PUBLICA, Y NO ES NEGOCIABLE
   Ni diagnóstico, ni medicamentos, ni estudios, ni procedimiento, ni el nombre
   completo del paciente. Solo lo que permite COTEJAR contra el papel: folio,
   fecha, médico con sus cédulas, e iniciales del paciente.

   La razón es que la URL es adivinable —el folio va impreso dentro del QR y la
   serie es correlativa: quien tenga uno puede caminar los demás—. Un
   diagnóstico es dato personal SENSIBLE bajo la LFPDPPP vigente, y las multas
   se duplican tratándose de ellos. La versión anterior de este archivo servía
   el `contenido` entero —paciente, diagnóstico y medicamentos— a quien
   escribiera el folio, sin caducidad y sin límite. Eso es lo que se corrige
   aquí.

   ⚠️ POR ESO `contenido` NO SE ATA A NINGUNA VARIABLE DE COMPONENTE. Se lee
   dentro de `leerDocumento()` y de ahí solo sale el puñado de campos de
   `Verificacion`. Si algún día ves `contenido` cruzando hacia el JSX, la fuga
   volvió.

   ⚠️ LA REFERENCIA DE ESTÉTICA Y DE POLÍTICA ES `/demo/receta`, que estrenó la
   minimización antes que esta página. Ojo: aquella todavía compone los
   medicamentos —son ficticios y es una demo de producto—, y esta ya no. No
   "alinees" esta con aquella copiándole la lista.

   SOLO LA FORMA NUEVA DEL FOLIO RESUELVE. `normalizarFolio()` acepta las nueve
   series de la columna —`RX-2026-0001`— y rechaza las tres formas viejas que
   viven dentro de `contenido` (`R-` + hex, `NOH-AAAAMMDD-SSSSS`,
   `COT-AAAAMMDD-SSSSS`). Que las viejas dejen de resolver es DELIBERADO: cada
   QR ya impreso es hoy una fuga, y dejar de servirlo es el arreglo.

   ⚠️ CONSECUENCIA QUE HAY QUE CONOCER: hoy el ÚNICO QR de verificación que se
   imprime es el de Receta, y `RecetaForm.tsx` lo compone sobre el `R-…` de
   `contenido`, no sobre la serie `RX-…` de la columna. Mientras eso siga así,
   ningún QR impreso resuelve —tampoco los que se impriman mañana—. Para que la
   verificación vuelva a servir hay que decidir qué folio va impreso en el papel
   y codificar ESE en el QR; ver la nota de `folio.ts` sobre por qué la receta
   imprime hoy el suyo y no el de serie.

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

/** Lo único que sale de la base hacia el render. Ver la cabecera. */
interface Verificacion {
  readonly folio: string
  readonly etiqueta: string
  readonly fecha: string
  readonly pacienteIniciales: string
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
 * `Ana Gabriela Solís` → `A. G. S.`
 *
 * Una inicial por palabra, sin filtrar partículas: `de la` sale como `D. L.` y
 * eso es feo pero inofensivo —el objetivo es cotejar, no componer un nombre—.
 * Filtrarlas costaría una lista de partículas que ningún dato justifica todavía.
 */
function iniciales(nombre: string | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(parte => parte !== '')
  if (partes.length === 0) return '—'
  return partes.map(parte => `${parte.charAt(0).toUpperCase()}.`).join(' ')
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
    pacienteIniciales: iniciales(texto(contenido, 'paciente')),
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
        <p className="text-xs text-slate-400 leading-relaxed">
          Esta página nunca publica el contenido clínico de un documento, exista o no.
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
        <div className="px-5 py-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {doc.cedulaProfesional !== undefined && (
            <span>
              <span className="font-semibold text-slate-600">Cédula Prof.:</span>{' '}
              {doc.cedulaProfesional}
            </span>
          )}
          {doc.cedulaEspecialidad !== undefined && (
            <span>
              <span className="font-semibold text-slate-600">Cédula Esp.:</span>{' '}
              {doc.cedulaEspecialidad}
            </span>
          )}
        </div>
      </div>

      {/* Lo que permite cotejar contra el papel. Iniciales, nunca el nombre. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Paciente
            </span>
            <p className="font-medium text-slate-800 mt-0.5">{doc.pacienteIniciales}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fecha de emisión
            </span>
            <p className="font-medium text-slate-800 mt-0.5">{doc.fecha}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          Se muestran solo las iniciales del paciente, y el contenido clínico no se publica. Quien
          verifica un documento necesita saber que es auténtico y quién lo firmó, no la condición
          clínica de la persona.
        </p>
      </div>

      {/* La declaración: es el producto de esta página. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">
            Este documento fue emitido con Spinus y es auténtico.
          </span>{' '}
          El folio, la fecha, el médico y sus cédulas mostrados arriba corresponden al registro
          original guardado en el expediente clínico electrónico. Si coinciden con el papel que
          tienes delante, el documento es el que se emitió.
        </p>
      </div>
    </Hoja>
  )
}
