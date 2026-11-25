/**
 * El motivo legible de una respuesta fallida de las rutas que usa la pantalla
 * de configuración del calendario (`/api/me/ajustes-agenda`, `/api/me/horario`,
 * `/api/agenda/tipos-cita`, `/api/consultorios/[id]`), o `porDefecto`.
 *
 * Esas rutas responden de dos formas: `{ error: <texto> }` en los 400 de Zod y
 * `{ error: <código>, mensaje: <texto> }` en los errores traducidos de la base
 * (`respuestaErrorTipoCita`). Se enseña `mensaje` si lo hay y, si no, `error`
 * SÓLO en un 400 o 409, que es cuando es un texto para el usuario y no un
 * código («no_disponible») o un «Sin permisos» sin contexto.
 *
 * Nombre distinto de cualquier componente de la carpeta a propósito (regla de
 * mayúsculas de `CLAUDE.md`).
 */
export async function leerMotivoError(res: Response, porDefecto: string): Promise<string> {
  const cuerpo: unknown = await res.json().catch(() => null)
  if (!cuerpo || typeof cuerpo !== 'object') return porDefecto
  if ('mensaje' in cuerpo && typeof cuerpo.mensaje === 'string') return cuerpo.mensaje
  if ((res.status === 400 || res.status === 409) && 'error' in cuerpo && typeof cuerpo.error === 'string') {
    return cuerpo.error
  }
  return porDefecto
}
