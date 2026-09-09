import { redirect } from 'next/navigation'

/**
 * Esta ruta ya no pinta nada: su contenido es la pestaña «Mediciones y
 * archivos» del expediente.
 *
 * ⚠️ SE CONSERVA COMO REDIRECCIÓN Y NO SE BORRA, por el mismo motivo que
 * `estado/`: hay enlaces vivos hacia aquí y urls que el médico puede tener
 * guardadas. La diferencia es el destino: éste lleva a la pestaña, así que la
 * redirección arrastra el parámetro.
 *
 * Vive bajo `[id]/`, así que hereda el guarda de rol del layout.
 */
export default async function LaboratoriosRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/expediente/${id}?tab=mediciones`)
}
