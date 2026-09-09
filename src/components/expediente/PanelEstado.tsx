'use client'

import { Ruler, Stethoscope } from 'lucide-react'
import type { Paciente } from '@/types'
import DashboardCard from './dashboard/DashboardCard'
import CardContentDatos from './dashboard/CardContentDatos'
import CardContentAntecedentes from './dashboard/CardContentAntecedentes'

/**
 * Las dos tarjetas que hasta ahora vivían en la ruta `/expediente/[id]/estado`.
 *
 * ⚠️ RECIBE EL PACIENTE POR PROP Y NO LO CONSULTA. Ese es el punto de sacarlo
 * de su ruta: aquella página repetía por su cuenta la misma consulta que ya
 * hacía el expediente, así que abrir el detalle y entrar a «Estado» pedía dos
 * veces la misma fila. Con el contenido dentro de una pestaña, la consulta se
 * hace una sola vez arriba. No le añadas un `useEffect` que la repita.
 *
 * ⚠️ ES CONTENIDO PROVISIONAL EN SU SITIO NUEVO. El spec disuelve estas dos
 * tarjetas dentro de la ficha clínica del Resumen; este bloque solo las muda de
 * ruta a pestaña, sin rediseñarlas. Por eso conservan su aspecto actual,
 * colores cableados incluidos: tocarlos aquí sería rediseñar lo que el bloque
 * siguiente va a sustituir.
 */
export default function PanelEstado({ paciente }: { paciente: Paciente }) {
  return (
    <div
      className="grid gap-[var(--sp-3)]"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
    >
      <DashboardCard icon={Ruler} iconColor="#af52de" title="Datos antropométricos" summary="Peso, talla, IMC, contacto">
        <CardContentDatos paciente={paciente} />
      </DashboardCard>
      <DashboardCard icon={Stethoscope} iconColor="var(--cp)" title="Antecedentes médicos" summary="Historial clínico">
        <CardContentAntecedentes paciente={paciente} />
      </DashboardCard>
    </div>
  )
}
