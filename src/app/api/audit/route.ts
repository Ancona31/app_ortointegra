import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAccess, logAudit, type AuditAccion } from '@/lib/audit'

/**
 * POST /api/audit — registrar lectura de recurso clínico
 *
 * NOM-024-SSA3: trazabilidad de quién consultó cada expediente.
 * El frontend llama este endpoint al abrir un expediente, consulta,
 * laboratorio o documento. Se valida la sesión server-side.
 *
 * `accion` es OPCIONAL y limitada a la allowlist de abajo: sin ella el
 * comportamiento es el de siempre (lectura → logAccess mapea por tabla).
 * Con ella se registra una acción explícita — hoy solo la exportación del
 * expediente completo a PDF, que no es una simple lectura.
 */

/** Acciones que el cliente puede pedir por nombre. Cerrada a propósito. */
const ACCIONES_PERMITIDAS: Record<string, AuditAccion> = {
  exportar_expediente: 'exportar_expediente',
  /* Las dos salidas del modal de documento generado que NO pasan por el
     servidor. El envío por correo no está aquí y no debe estarlo: lo audita su
     propia ruta, que además conoce el destinatario. Estas dos ocurren enteras
     en el navegador —hoja de compartir del sistema o descarga— así que el
     cliente es el único que puede avisar de que pasaron. */
  compartir_documento: 'compartir_documento',
  descargar_documento: 'descargar_documento',
}

const DESCRIPCION: Record<string, string> = {
  exportar_expediente: 'Exportación del expediente completo a PDF',
  compartir_documento: 'Documento compartido con la hoja del sistema (destino no observable)',
  descargar_documento: 'Documento descargado al dispositivo',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tabla, registroId, accion } = await req.json()

  const tablasPermitidas = ['pacientes', 'consultas', 'documentos']
  if (!tabla || !tablasPermitidas.includes(tabla)) {
    return NextResponse.json({ error: 'Tabla inválida' }, { status: 400 })
  }

  if (!registroId || typeof registroId !== 'string') {
    return NextResponse.json({ error: 'registroId requerido' }, { status: 400 })
  }

  if (accion !== undefined && !ACCIONES_PERMITIDAS[accion]) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  /**
   * ⚠️ LA FILA TIENE QUE SER VISIBLE PARA QUIEN LA FIRMA, y esto no estaba.
   * Se validaba la sesión, la tabla y la acción, pero NO que el `registroId`
   * fuera suyo: cualquier médico autenticado podía escribir
   * `compartir_documento` sobre el uuid de un documento de otra clínica. No hay
   * fuga —aquí no se lee nada— pero ensucia con constancias falsas un registro
   * que la NOM-024 exige como prueba, y ahí la integridad pesa tanto como la
   * presencia.
   *
   * ⚠️ SE COMPRUEBA CON EL CLIENTE DE SESIÓN Y NO CON UNA REGLA ESCRITA AQUÍ:
   * la consulta pasa por la RLS, que es la que ya sabe qué ve cada médico según
   * clínica y rol. Una condición copiada a mano en esta ruta sería una segunda
   * definición de lo mismo, y de las dos sólo una se mantendría.
   *
   * ⚠️ NO SE REUSA `documentoDelMedico` de `/api/email/enviar-documento`, y
   * conviene saber por qué: aquel exige además AUTORÍA y rechaza borradores,
   * que son reglas de ENVIAR y no de mirar. Con ellas, un colega de la misma
   * clínica que descarga un documento que no emitió —cosa que la interfaz
   * permite— no quedaría registrado. Y `exportar_expediente` ni siquiera opera
   * sobre `documentos`. Lo que hace falta aquí es más débil y más general: que
   * el registro sea tuyo de ver.
   *
   * ⚠️ SÓLO PARA LAS ACCIONES CON NOMBRE. El camino de `logAccess` —el de
   * `useAuditAccess`— se queda sin validar A PROPÓSITO: dos de sus llamadas
   * pasan el id del PACIENTE bajo otra tabla (`documentos/page.tsx:64` y
   * `nueva-nota/page.tsx:198`, donde la nota aún no existe), así que validarlas
   * las haría fallar en silencio y perderíamos registros de acceso que hoy sí se
   * escriben. Ese desajuste es anterior y se anota aparte.
   */
  /**
   * ⚠️ TRES DESENLACES, NO DOS, Y LA DIFERENCIA ES LO QUE HACE QUE ESTE REGISTRO
   * SIRVA DE PRUEBA. Aquí se descartaba el `error` de la consulta, así que
   * `fila === null` significaba a la vez «no es tuya» y «no se pudo comprobar»
   * —un segundo malo de red, una caída de Supabase— y los dos acababan en 404.
   * El cliente se lo traga: es fire-and-forget. O sea que un PDF con datos
   * clínicos podía salir de la app sin dejar la ÚNICA marca que iba a existir de
   * esa salida, y sin que nadie se enterara.
   *
   * Para un `audit_log` exigible la completitud pesa tanto como la integridad,
   * así que sólo se rechaza cuando consta que la fila NO es visible. Si la
   * comprobación no pudo hacerse, se escribe igual y se dice en la descripción,
   * que es una constancia honesta: quien audite ve el asiento y ve que su
   * propiedad no se verificó.
   */
  let propiedadSinVerificar = false
  if (accion) {
    const { data: fila, error: errorFila } = await supabase
      .from(tabla as string)
      .select('id')
      .eq('id', registroId)
      .maybeSingle()

    /* `22P02` es «invalid input syntax»: el `registroId` no es un uuid. No es un
       fallo transitorio sino una petición mal formada, y no puede corresponder a
       ningún registro real — se rechaza en vez de dejar basura. */
    if ((errorFila as { code?: string } | null)?.code === '22P02') {
      return NextResponse.json({ error: 'registroId inválido' }, { status: 400 })
    }
    if (errorFila) {
      propiedadSinVerificar = true
    } else if (!fila) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }
  }

  // fire-and-forget — no bloquea la respuesta
  if (accion) {
    logAudit({
      userId: user.id,
      accion: ACCIONES_PERMITIDAS[accion],
      tabla,
      registroId,
      ip,
      descripcion: propiedadSinVerificar
        ? `${DESCRIPCION[accion]} · propiedad del registro NO verificada (fallo al comprobarla)`
        : DESCRIPCION[accion],
    })
  } else {
    logAccess(user.id, tabla, registroId, ip)
  }

  return NextResponse.json({ ok: true })
}
