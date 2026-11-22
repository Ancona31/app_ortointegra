'use client'

import Link from 'next/link'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { calcularEdad } from '@/lib/patientUtils'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { ListaChipsMedicos } from '@/components/expediente/ChipMedico'
import { KebabAccionesPaciente } from '@/components/expediente/KebabAccionesPaciente'
import type { PacienteExpediente, OrdenColumna, OrdenDireccion } from '@/lib/expediente/fetchPacientes'

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

/* Rediseño B6 (maqueta `final-lista`). La tabla sólo se pinta en `ih`, `iv` y
   `esc` (la página la esconde en `ext`/`tel`, donde va la lista). Por formato,
   sólo con CSS:
     esc       columna «Edad» con «61 años · Femenino»;
     ih / iv   sin columna «Edad»: esa línea baja bajo el nombre (CALMA §23.5).
               Ordenar por edad sigue en «Ordenado por» (menú de la página).
   La columna «Paciente» es la elástica (`w-full`) y recorta el nombre: así la
   tabla cabe en los 651 px útiles de `ih` sin desplazarse. */

/* Lo que se escribe en la celda que ordena la lista va en 600 `--tinta` (CALMA §12). */
function claseDato(activa: boolean): string {
  return activa ? 'font-semibold text-tinta' : 'text-tinta2'
}

const CELDA = 'py-2.5 pr-4 ih:pr-2.5 iv:pr-2.5 align-middle'

interface Props {
  pacientes: PacienteExpediente[]
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
  /**
   * Falso para la secretaria (y mientras el profile carga). Gobierna el kebab
   * Y el enlace de la fila al expediente, porque son el mismo permiso: el
   * layout de /expediente/[id] expulsa al rol 'secretaria' de todo el subárbol,
   * así que una fila-enlace la llevaría a un redirect. Si algún día dejan de
   * coincidir, sepáralos en dos props en vez de reutilizar éste.
   */
  mostrarAcciones: boolean
}

function ThOrdenable({
  col,
  orden,
  direccion,
  onOrden,
  className = '',
  children,
}: {
  col: OrdenColumna
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
  className?: string
  children: React.ReactNode
}) {
  const activa = orden === col
  const Flecha = direccion === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      aria-sort={activa ? (direccion === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`py-2 pr-4 ih:pr-2.5 iv:pr-2.5 text-left text-[13px] leading-[18px] font-normal whitespace-nowrap ih:whitespace-normal iv:whitespace-normal ${className}`}
    >
      <button
        type="button"
        onClick={() => onOrden(col)}
        className={`relative inline-flex min-h-9 min-w-9 iv:min-h-11 items-center gap-1 rounded-md text-left transition-colors hover:text-enlace focus-visible:outline-[3px] focus-visible:outline-enlace ${activa ? 'font-semibold text-enlace' : 'text-tinta2'}`}
      >
        {children}
        {activa && <Flecha size={14} aria-hidden="true" />}
      </button>
    </th>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 pr-4 ih:pr-2.5 iv:pr-2.5 text-left text-[13px] leading-[18px] font-normal text-tinta2 whitespace-nowrap">
      {children}
    </th>
  )
}

export function TablaPacientesExpediente({ pacientes, orden, direccion, onOrden, mostrarAcciones }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-linea">
            <ThOrdenable col="apellidos" orden={orden} direccion={direccion} onOrden={onOrden} className="w-full pl-0">
              <span className="pl-11">Paciente</span>
            </ThOrdenable>
            <ThOrdenable col="fecha_nacimiento" orden={orden} direccion={direccion} onOrden={onOrden} className="hidden esc:table-cell">Edad</ThOrdenable>
            <ThOrdenable col="numero_expediente" orden={orden} direccion={direccion} onOrden={onOrden}>Expediente</ThOrdenable>
            <ThOrdenable col="created_at" orden={orden} direccion={direccion} onOrden={onOrden}>Fecha de ingreso</ThOrdenable>
            <Th>Médicos</Th>
            {mostrarAcciones && <th className="w-9 py-2" aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {pacientes.map((p, i) => {
            const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const sexoLabel = p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'
            const edadSexo = `${edad !== null ? `${edad.textoElegante} · ` : ''}${sexoLabel}`
            return (
              <tr key={p.id} className="border-b border-linea last:border-0">
                <td className={`${CELDA} max-w-0`}>
                  <div className="flex min-w-0 items-center gap-3 ih:gap-2.5 iv:gap-2.5">
                    <div className={`k-avatar k-avatar-32 ${avatarColor}`} aria-hidden="true">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      {/* Este enlace cubre SOLO el nombre, y no debe volver a
                          estirarse sobre la fila. Se intentó con un ::after
                          `absolute inset-0` anclado al <tr>, y no funciona en ningún
                          motor: ni Blink ni WebKit crean bloque contenedor para una
                          fila de tabla (WebKit tampoco con `border-collapse:
                          separate`, que en Blink sí bastaba). Sin ese anclaje el
                          overlay sube hasta el contenedor de /expediente y se
                          estira sobre la pantalla entera: el buscador, los filtros y
                          los encabezados de orden dejan de responder, y cualquier
                          clic navega al último paciente de la lista, porque los N
                          overlays se apilan y gana el último del DOM. Reintroducirlo
                          reabre ese bug. Lo que se buscaba —que Next precargue el
                          expediente— lo da el <Link> por sí solo; lo único que se
                          pierde es el clic en toda la fila. La lista de `ext`/`tel`
                          sí puede estirar el suyo: allí el ancla es un
                          <div class="relative"> normal, que es CSS estándar. */}
                      {mostrarAcciones ? (
                        <Link
                          href={`/expediente/${p.id}`}
                          className="-my-2 block truncate rounded py-2 iv:-my-3 iv:py-3 text-[15px] leading-5 font-semibold text-tinta hover:text-enlace focus-visible:outline-[3px] focus-visible:outline-enlace"
                        >
                          {p.nombre} {p.apellidos}
                        </Link>
                      ) : (
                        <p className="truncate text-[15px] leading-5 font-semibold text-tinta">
                          {p.nombre} {p.apellidos}
                        </p>
                      )}
                      <p className="esc:hidden truncate text-[13px] leading-[18px] text-tinta2">{edadSexo}</p>
                    </div>
                  </div>
                </td>
                <td className={`${CELDA} hidden esc:table-cell whitespace-nowrap text-[14px] ${orden === 'fecha_nacimiento' ? 'text-tinta' : 'text-tinta2'}`}>
                  {edad !== null ? <><span className={orden === 'fecha_nacimiento' ? 'font-semibold' : ''}>{edad.textoElegante}</span> · </> : ''}{sexoLabel}
                </td>
                <td className={`${CELDA} whitespace-nowrap text-[14px] ih:text-[13px] iv:text-[13px] k-num ${claseDato(orden === 'numero_expediente')}`}>
                  {p.numero_expediente || '—'}
                </td>
                <td className={`${CELDA} whitespace-nowrap text-[14px] ih:text-[13px] iv:text-[13px] k-num ${claseDato(orden === 'created_at')}`}>
                  {/* `TZ_CLINICA`, no el huso del dispositivo: el ingreso es un dato
                      de expediente —hermano de la fecha de apertura de la hoja
                      frontal—, no una hora de cita. Ver LA REGLA en `@/lib/dates`. */}
                  {p.created_at ? renderEnTZ(p.created_at, 'd MMM yyyy', TZ_CLINICA) : '—'}
                </td>
                <td className={`${CELDA} whitespace-nowrap`}>
                  <ListaChipsMedicos medicos={p.medicos} max={1} />
                </td>
                {mostrarAcciones && (
                  /* `relative z-10` levanta esta celda sobre la capa del enlace:
                     sin esto el clic en el kebab navegaría al expediente. El
                     botón es de `KebabAccionesPaciente` (fuera de B6): aquí sólo
                     se le da el área mínima de `ih`/`esc` (36). */
                  <td className="relative z-10 w-9 py-1.5 [&_button]:inline-flex [&_button]:min-h-9 [&_button]:min-w-9 iv:[&_button]:min-h-11 iv:[&_button]:min-w-11 [&_button]:items-center [&_button]:justify-center">
                    <KebabAccionesPaciente pacienteId={p.id} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
