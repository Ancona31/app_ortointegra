'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil, FilePlus2, Stethoscope, User } from 'lucide-react'
import type { Paciente } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import { PALETA_AVATAR } from '@/components/dashboard/paletaAvatar'
import ExportarExpedienteButton from './ExportarExpedienteButton'

const SEXO_LABEL: Record<Paciente['sexo'], string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

/* La geometría de los cuatro controles de la cabecera, en un solo sitio. La
   región 1 del spec pide que midan lo mismo y que su texto no se parta en dos
   líneas; con cada uno trayendo la suya, basta un retoque para desalinearlos.
   ⚠️ 44 px Y NO LOS 42 DEL ANEXO, y no es un redondeo: `--sp-tap` es el área
   táctil mínima del sistema y su comentario dice «nunca menor». `.sp-btn` ya la
   impone como `min-height`, así que el `h-[42px]` que había aquí NO LLEGABA A
   APLICARSE —los dos botones del sistema medían 44 y los otros dos, cada uno lo
   suyo—. La app manda sobre el mockup.
   ⚠️ VA EN `style` Y NO EN UNA CLASE. `.sp-btn--primary` suma 13 px de relleno
   vertical a un texto de 15.5, así que se pasa de 44 por su cuenta; sólo
   fijando `height` y anulando ese relleno quedan los cuatro a la misma altura.
   Mismo recurso que `DocumentosRecientes`: `style` gana a la clase. */
const GEOMETRIA_ACCION: React.CSSProperties = {
  height: 'var(--sp-tap)',
  minHeight: 'var(--sp-tap)',
  borderRadius: 'var(--sp-r-btn)',
  paddingTop: 0,
  paddingBottom: 0,
  /* ⚠️ EL RELLENO LATERAL TAMBIÉN SE UNIFICA AQUÍ, y por eso ninguna de las
     cuatro lo trae en su clase. Venían con 24, 24, 20 y 26 px de sus variantes
     respectivas; a 14 px los cuatro miden lo mismo y la fila baja de ~660 px a
     ~584 de los 960 útiles. Lo que queda de ancho ya es texto, no relleno. */
  paddingLeft: 'var(--sp-3-5)',
  paddingRight: 'var(--sp-3-5)',
}

/* ⚠️ EL AVATAR TOMA UNA POSICIÓN FIJA DE LA PALETA, Y ESO ES DELIBERADO.
   `PALETA_AVATAR` se hizo para LISTAS: allí la rotación por índice es lo que
   garantiza que cuatro tarjetas salgan de cuatro colores distintos. Aquí hay UN
   solo paciente en pantalla y no hay nada de lo que distinguirlo, así que la
   rotación no tiene sentido y elegir por su id tampoco: daría un color distinto
   por paciente sin que ese color signifique nada, y el mismo expediente
   cambiaría de tono respecto del dashboard, donde su color sí sale de su
   posición en una lista.
   Se fija la primera entrada. Si algún día esta cabecera pinta más de un
   paciente a la vez, entonces sí toca rotar. */
const COLOR_AVATAR = PALETA_AVATAR[0]

export default function CabeceraPaciente({ paciente, isDoctor, onEditar, onNuevoDocumento }: {
  paciente: Paciente
  isDoctor: boolean
  onEditar: () => void
  onNuevoDocumento: () => void
}) {
  const edad = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento).anios : null
  const nombreCompleto = `${paciente.nombre} ${paciente.apellidos}`.trim()
  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellidos[0] ?? ''}`.toUpperCase()

  /* Los cinco datos de identificación del spec, en su orden, separados por punto
     medio. Los que faltan NO dejan hueco ni guion: salen de la línea. El
     teléfono vive aquí desde el rediseño; antes estaba en antropometría. */
  const identificacion = [
    edad !== null ? `${edad} años` : null,
    SEXO_LABEL[paciente.sexo],
    paciente.fecha_nacimiento,
    paciente.numero_expediente ? `Exp. ${paciente.numero_expediente}` : null,
    paciente.telefono,
  ].filter(Boolean) as string[]

  return (
    <div className="pb-[var(--sp-4-5)]">
      <Link
        href="/expediente"
        prefetch={false}
        className="inline-flex items-center gap-[var(--sp-1)] mb-[var(--sp-3)] text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)] transition-colors hover:text-[var(--sp-ink-700)]"
      >
        <ArrowLeft size={12} /> Volver a pacientes
      </Link>

      {/* ⚠️ DOS FILAS SIEMPRE, TAMBIÉN EN ESCRITORIO. Antes identidad y acciones
          compartían renglón (`lg:flex-row lg:justify-between`) y el nombre
          quedaba con lo que sobrara: en cuanto había cuatro botones al lado, el
          `truncate` se comía el apellido y el número de expediente. El nombre es
          el título de la pantalla; no se recorta para dejarle sitio a un botón. */}
      <div className="flex flex-col gap-[var(--sp-4)]">
        {/* Fila 1 · Identidad. Sin `truncate`: nombre y línea de datos salen
            enteros y, si hace falta, envuelven.
            ⚠️ `items-start` EN MÓVIL Y NO `items-center`. Ahí el nombre parte en
            dos líneas y la identificación en tres, así que el bloque de texto
            mide ~5 renglones: centrado, el avatar se iba a la mitad de esa
            altura y quedaba flotando frente al hueco entre líneas. Alineado
            arriba acompaña al nombre, que es lo que nombra. En escritorio el
            texto son dos líneas y el centrado sigue siendo lo correcto.
            ⚠️ AVATAR DE 40 px EN MÓVIL, que es la medida del anexo §10 para ese
            ancho: a 50 px pesaba de más al lado de un texto envuelto. */}
        <div className="flex items-start gap-[var(--sp-3)] lg:items-center lg:gap-[var(--sp-3-5)]">
          <span
            className="w-[40px] h-[40px] lg:w-[50px] lg:h-[50px] shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] text-[length:var(--sp-fs-btn-sm)] lg:text-[length:var(--sp-fs-btn-md)] font-extrabold"
            style={{ background: COLOR_AVATAR.bg, color: COLOR_AVATAR.ink }}
          >
            {iniciales || <User size={18} />}
          </span>
          <div>
            {/* ⚠️ SIN CHIP DE DIAGNÓSTICO. Estaba aquí y el spec lo retira: el
                diagnóstico vive en la ficha del Resumen, y duplicarlo compite
                con el nombre, que es el título de la página. No lo devuelvas. */}
            {/* `--sp-fs-patient` y no `--sp-fs-page`: son roles distintos y el
                spec le da tamaño propio al nombre del paciente. */}
            <h1 className="text-[length:var(--sp-fs-patient)] font-extrabold tracking-tight leading-tight text-[var(--sp-ink-900)]">
              {nombreCompleto}
            </h1>
            <p className="text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-snug)] text-[var(--sp-ink-500)]">
              {identificacion.join(' \u00B7 ')}
            </p>
          </div>
        </div>

        {/* Fila 2 · Acciones. Las cuatro salen de `GEOMETRIA_ACCION`, así que
            comparten alto, radio y relleno; el color y la tipografía los pone su
            variante de `.sp-btn`.
            ESCRITORIO: en fila, alineadas a la derecha — son accesos ocasionales
            y no compiten con el nombre, que abre la fila de arriba por la
            izquierda.
            ⚠️ MÓVIL: RETÍCULA DE DOS COLUMNAS CON `order`, y el orden VISUAL no
            es el del código. Sueltas en `flex-wrap` se repartían dos y dos,
            descentradas y con anchos distintos. Aquí bajan a ancho completo las
            dos de crear —primaria arriba— y comparten renglón las dos cortas.
            ⚠️ «NUEVO DOCUMENTO» VA A ANCHO COMPLETO Y NO EN MEDIA COLUMNA, y
            no es una preferencia: con `px-4` de página, media columna mide 174
            px en un móvil de 390 y baja a 159 en uno de 360; el rótulo pide
            ~173 con su icono y su relleno, y lleva `whitespace-nowrap`. La
            pareja de abajo son los dos rótulos que caben hasta en 320 px. */}
        {isDoctor && (
          <div className="grid grid-cols-2 gap-[var(--sp-2-5)] lg:flex lg:flex-wrap lg:items-center lg:justify-end">
            <button
              type="button"
              onClick={onEditar}
              style={GEOMETRIA_ACCION}
              className="order-3 sp-btn sp-btn--secondary whitespace-nowrap lg:order-none"
            >
              <Pencil size={14} /> Editar
            </button>

            {/* Hace su propia consulta de consultas y addendums: no se le pasan
                las de la página, que vienen acotadas a 50. La geometría le baja
                por prop para que no pueda divergir de las otras tres. */}
            <ExportarExpedienteButton paciente={paciente} estilo={GEOMETRIA_ACCION} clase="order-4 lg:order-none" />

            <button
              type="button"
              onClick={onNuevoDocumento}
              style={GEOMETRIA_ACCION}
              /* Contorno de acento: no existe variante de `.sp-btn` para esto,
                 así que se compone a mano, pero SÓLO con tokens. El tamaño es
                 `--sp-fs-btn-sm`, el mismo de los dos secundarios de al lado
                 —antes era `--sp-fs-body-sm` y se leía un punto más pequeño. */
              className="order-2 col-span-2 lg:order-none inline-flex items-center justify-center gap-[var(--sp-gap-item)] whitespace-nowrap border border-[color:var(--sp-primary-border)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-primary-text)] transition-colors hover:bg-[var(--sp-primary-bg-faint)]"
            >
              <FilePlus2 size={15} /> Nuevo documento
            </button>

            <Link
              href={`/expediente/${paciente.id}/nueva-nota`}
              /* Sin precarga, como todo enlace nuevo del rediseño: cuesta dos
                 peticiones RSC y dos lambdas por carga, se pulse o no. */
              prefetch={false}
              style={GEOMETRIA_ACCION}
              className="order-1 col-span-2 sp-btn sp-btn--primary whitespace-nowrap lg:order-none"
            >
              <Stethoscope size={15} /> Nueva consulta
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
