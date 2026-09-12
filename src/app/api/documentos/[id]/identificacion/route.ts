/**
 * La foto de identificación del anexo — GUIA_FORMULARIOS_05 §6.
 *
 * ── POR QUÉ ESTA RUTA EXISTE ────────────────────────────────────────────────
 * El bucket `identificaciones` está CERRADO A TODOS LOS USUARIOS: la policy
 * `identificaciones_deny_all_users` es RESTRICTIVE y deniega a `anon` y a
 * `authenticated` sin excepción, incluido el médico que sube la foto (bloque D
 * de `20260813_firmas_documento.sql`). Una identificación oficial es el dato más
 * sensible que guarda el sistema y sigue el patrón de `firmas-medicos`.
 *
 * Eso obliga a las dos mitades de este archivo:
 *
 *   POST · sube con privilegios de servicio, tras comprobar que quien sube es el
 *          médico dueño del documento y que el documento sigue en `borrador`.
 *   GET  · la sirve como data-URL con la misma comprobación, porque el PDF se
 *          genera EN EL NAVEGADOR y la foto tiene que llegar a su memoria para
 *          incrustarse en la hoja de anexo.
 *
 * ⚠ SE VALIDAN LOS PRIMEROS BYTES, NO EL TIPO DECLARADO. `allowed_mime_types`
 * del bucket comprueba lo que dice quien sube, no lo que el archivo es: un
 * ejecutable con `Content-Type: image/jpeg` entraría. Y entraría en el único
 * bucket del sistema que después se descarga y se incrusta en un documento.
 *
 * ⚠ SOLO SE SUBE A UN BORRADOR, igual que el guardián de `firmas_documento`
 * solo admite firmar uno. La coherencia no es estética: la fila de la firma es
 * inmutable y lleva la ruta dentro, así que aceptar una foto para un documento
 * ya sellado escribiría un objeto que ninguna fila puede llegar a nombrar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'identificaciones'

/** El tope del bucket. Se comprueba aquí también: el error propio se lee mejor. */
const MAX_BYTES = 5 * 1024 * 1024

/** Los cuatro del flujo. El médico no tiene identificación anexa: informa, no consiente. */
const ROLES = ['paciente', 'familiar', 'testigo_1', 'testigo_2'] as const

/**
 * Los dos que el generador de PDF sabe decodificar, por su firma binaria.
 * `0xFF 0xD8 0xFF` es SOI + el primer marcador de JPEG; los ocho de PNG son su
 * cabecera fija, con el `0x0D 0x0A 0x1A 0x0A` que detecta transferencias en
 * modo texto.
 */
const FIRMAS = [
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
] as const

/** Qué es el archivo DE VERDAD. `null` si no es ninguno de los dos. */
function tipoReal(buffer: Buffer): { mime: string; ext: string } | null {
  for (const firma of FIRMAS) {
    if (firma.bytes.every((b, i) => buffer[i] === b)) {
      return { mime: firma.mime, ext: firma.ext }
    }
  }
  return null
}

/**
 * Comprueba que quien llama es el médico dueño del documento.
 *
 * `subido_por` va explícito además de la RLS: la policy ya filtra, pero esta
 * ruta usa el cliente de servicio a continuación y la comprobación tiene que
 * ser legible en el mismo sitio donde se decide.
 */
async function documentoDelMedico(
  id: string,
  soloBorrador: boolean,
): Promise<{ ok: true } | { ok: false; estado: number; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, estado: 401, error: 'No autenticado' }

  const { data: doc } = await supabase
    .from('documentos')
    .select('id, estado')
    .eq('id', id)
    .eq('subido_por', user.id)
    .maybeSingle()

  // Un documento ajeno y uno inexistente responden lo mismo: distinguirlos sería
  // un oráculo de identificadores, que es lo que el guardián de las firmas cierra
  // en la base por este mismo motivo.
  if (!doc) return { ok: false, estado: 404, error: 'Documento no encontrado' }
  if (soloBorrador && doc.estado !== 'borrador') {
    return { ok: false, estado: 409, error: 'El documento ya no es un borrador' }
  }
  return { ok: true }
}

/* ── POST · sube la foto ──────────────────────────────────────────────────── */

export async function POST(req: NextRequest, ctx: RouteContext<'/api/documentos/[id]/identificacion'>) {
  try {
    const { id } = await ctx.params
    const permiso = await documentoDelMedico(id, true)
    if (!permiso.ok) return NextResponse.json({ error: permiso.error }, { status: permiso.estado })

    const form = await req.formData()
    const archivo = form.get('foto')
    const rol = form.get('rol')
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }
    if (typeof rol !== 'string' || !ROLES.includes(rol as (typeof ROLES)[number])) {
      return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
    }
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La foto supera los 5 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await archivo.arrayBuffer())
    const tipo = tipoReal(buffer)
    if (!tipo) {
      return NextResponse.json({ error: 'El archivo no es una imagen JPEG o PNG' }, { status: 400 })
    }

    // `upsert`: rehacer una firma vuelve a pasar por aquí con el mismo rol, y lo
    // que vale es la última foto — la anterior pertenece a un trazo descartado.
    const ruta = `${id}/${rol}.${tipo.ext}`
    const admin = createAdminClient()
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(ruta, buffer, { contentType: tipo.mime, upsert: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ path: ruta })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── GET · la sirve para incrustarla en el PDF ────────────────────────────── */

export async function GET(req: NextRequest, ctx: RouteContext<'/api/documentos/[id]/identificacion'>) {
  try {
    const { id } = await ctx.params
    // Sin `soloBorrador`: reimprimir un consentimiento ya sellado tiene que poder
    // recomponer su anexo, y para entonces el documento es terminal por diseño.
    const permiso = await documentoDelMedico(id, false)
    if (!permiso.ok) return NextResponse.json({ error: permiso.error }, { status: permiso.estado })

    const ruta = req.nextUrl.searchParams.get('path') ?? ''
    // La ruta llega de la fila de la firma, pero llega por la red: sin este
    // prefijo, un identificador propio serviría para leer la identificación
    // guardada bajo cualquier otro documento.
    if (!ruta.startsWith(`${id}/`) || ruta.includes('..')) {
      return NextResponse.json({ error: 'Ruta no válida' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.storage.from(BUCKET).download(ruta)
    if (error || !data) {
      return NextResponse.json({ error: 'Identificación no encontrada' }, { status: 404 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const tipo = tipoReal(buffer)
    if (!tipo) return NextResponse.json({ error: 'Archivo ilegible' }, { status: 422 })

    // Data-URL y no URL firmada: el PDF se compone en el navegador y la imagen
    // acaba DENTRO del archivo emitido, así que reimprimir dentro de un año no
    // depende de que la foto —ni su firma temporal— sigan existiendo.
    return NextResponse.json({
      dataUrl: `data:${tipo.mime};base64,${buffer.toString('base64')}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
