import { redirect } from 'next/navigation'

/**
 * Esta ruta ya no pinta nada: su contenido es la pestaña «Resumen» del
 * expediente.
 *
 * ⚠️ SE CONSERVA COMO REDIRECCIÓN Y NO SE BORRA. La parrilla de tarjetas del
 * expediente enlaza aquí, y sobre todo: es una url que el médico puede tener
 * guardada o abierta en otra pestaña. Borrarla daría un 404 donde antes había
 * un expediente. La redirección es permanente en intención pero se resuelve en
 * el servidor en cada visita, así que el día que la pestaña cambie de nombre
 * basta con tocar esta línea.
 *
 * Vive bajo `[id]/`, así que hereda el guarda de rol del layout: la secretaria
 * no llega ni aquí ni al destino.
 */
export default async function EstadoRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/expediente/${id}`)
}
