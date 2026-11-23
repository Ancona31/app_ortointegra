'use client'

import Link from 'next/link'
import { useId, useSyncExternalStore } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, FileBadge, ImageIcon, PenLine } from 'lucide-react'

/**
 * El aviso de perfil incompleto: tarjeta ámbar colapsable. Vive en la barra
 * lateral (`esc`, `ih`), en el cajón (`tel`, `iv`) y dentro de «Más» (`ext`,
 * `iv`); el número va además como distintivo sobre «···» o sobre el botón de
 * menú (CALMA §28). Sólo médico: lo decide `Sidebar.tsx`.
 *
 * ⚠️ TIENE QUE SEGUIR LLAMANDO LA ATENCIÓN HASTA QUE EL PERFIL ESTÉ COMPLETO:
 * un médico que no se entera de que le falta la firma acaba pensando que los
 * documentos salen mal y levanta un ticket. Desde el rediseño lo hace sin
 * animaciones infinitas (ver la nota del `return`).
 *
 * ⚠️ QUÉ SE MUESTRA Y CUÁNDO NO SE TOCA AQUÍ. Las tres condiciones —firma,
 * cédula de especialidad (solo si no es medicina general) y logo— las resuelve
 * el servidor en `/api/me/estado-perfil` y llegan por props. Esto es pintura.
 *
 * ⚠️ LOS TRES DESTINOS SON `/perfil`, Y NO ES UN ATAJO. La spec los manda a
 * «Mi perfil → Firma», «Mi perfil → Datos profesionales» y «Administración →
 * Clínica»; comprobado en el repo: la última NO EXISTE —el grupo Administración
 * es Estadísticas, Usuarios y Facturación, y el logo de la clínica se edita en
 * Mi perfil—, y aunque `/perfil` admite enlaces profundos por `?tab=`, los tres
 * datos viven en la pestaña `datos`, que es la de por defecto y cuyo parámetro
 * la propia página borra de la URL. No hay ancla más fina que inventar.
 */

/**
 * Qué le falta al médico. Vivía en `BannerPerfilPendiente`, el banner de
 * `/inicio`, mientras los dos compartían contrato; ese banner se retiró —el
 * aviso vive solo aquí— y esto se mudó con su único consumidor en vez de
 * quedarse en un archivo sin nada más dentro.
 */
export interface AvisosPerfil {
  faltaFirma: boolean
  faltaLogo: boolean
  faltaCedulaEspecialidad: boolean
}

/** True si hay algo que avisar. */
export function hayAvisos(a: AvisosPerfil): boolean {
  return a.faltaFirma || a.faltaLogo || a.faltaCedulaEspecialidad
}

const CLAVE_COLAPSO = 'spinus.profileBanner.collapsed'

interface Props extends AvisosPerfil {
  /* ⚠️ EL CIERRE DEL MENÚ MÓVIL ENTRA POR PROP. En móvil la barra tapa la
     pantalla entera: sin esto, pulsar cualquier enlace de aquí navega y deja el
     menú encima del destino. Quien sabe que hay un menú que cerrar es
     `Sidebar.tsx`, y es quien lo pasa. */
  alNavegar?: () => void
}

/** Lo guardado: si estaba colapsado, y CON QUÉ pendientes lo estaba (§8). */
interface ColapsoGuardado {
  colapsado: boolean
  claves: string[]
}

/* ⚠️ `localStorage` SE LEE CON `useSyncExternalStore` Y NO CON UN EFECTO, y no
   es preferencia de estilo: leerlo durante el render rompería la hidratación
   —en el servidor no existe— y hacerlo en un `useEffect` con `setState` es
   justo lo que el lint del proyecto rechaza (`react-hooks/set-state-in-effect`,
   ver la nota de `ModalDocumentoGenerado.tsx:125`). Con este hook el servidor
   responde `null` —o sea, desplegado, que es el default de §8— y el cliente lee
   el valor real después de hidratar, que es el camino soportado.
   Los suscriptores existen para que al plegar/desplegar el propio componente se
   entere de su escritura: sin ellos habría que duplicar el estado en memoria. */
const suscriptores = new Set<() => void>()

function suscribirColapso(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar)
  return () => { suscriptores.delete(alCambiar) }
}

/* Devuelve la CADENA CRUDA, no un objeto: `useSyncExternalStore` compara con
   `Object.is` y un objeto nuevo en cada lectura sería un bucle de renders. */
function leerColapso(): string | null {
  try {
    return localStorage.getItem(CLAVE_COLAPSO)
  } catch {
    /* Safari en privado o cuota llena: sin almacén, nace desplegado. */
    return null
  }
}

function leerColapsoEnServidor(): string | null {
  return null
}

function guardarColapso(dato: ColapsoGuardado): void {
  try {
    localStorage.setItem(CLAVE_COLAPSO, JSON.stringify(dato))
  } catch {
    /* silent: se pierde la preferencia, no el aviso */
  }
  suscriptores.forEach((s) => s())
}

export default function AvisoPerfilSidebar({
  faltaFirma, faltaLogo, faltaCedulaEspecialidad, alNavegar,
}: Props) {
  const idCuerpo = `${useId()}-pendientes`
  const guardadoCrudo = useSyncExternalStore(suscribirColapso, leerColapso, leerColapsoEnServidor)

  const pendientes = [
    { clave: 'firma', texto: 'Documentos sin firma', Icono: PenLine, visible: faltaFirma },
    { clave: 'cedula', texto: 'Sin cédula de especialidad', Icono: FileBadge, visible: faltaCedulaEspecialidad },
    { clave: 'logo', texto: 'Clínica sin logo', Icono: ImageIcon, visible: faltaLogo },
  ].filter((p) => p.visible)

  const claves = pendientes.map((p) => p.clave).join(',')

  /* ⚠️ SE REABRE SOLO SI APARECE UN PENDIENTE NUEVO (§8). Si el conjunto de
     claves con el que se plegó no cubre al de ahora, el pliegue no se aplica:
     haber plegado «documentos sin firma» no puede esconder para siempre un
     aviso que todavía no existía cuando se plegó. */
  const colapsado = (() => {
    if (!guardadoCrudo) return false
    try {
      const guardado = JSON.parse(guardadoCrudo) as ColapsoGuardado
      if (!guardado?.colapsado) return false
      const conocidas = new Set(guardado.claves ?? [])
      return !claves.split(',').filter(Boolean).some((c) => !conocidas.has(c))
    } catch {
      /* Un valor corrupto no encierra el aviso: se ignora y nace desplegado. */
      return false
    }
  })()

  function alternar() {
    guardarColapso({ colapsado: !colapsado, claves: claves.split(',').filter(Boolean) })
  }

  if (!hayAvisos({ faltaFirma, faltaLogo, faltaCedulaEspecialidad })) return null

  const n = pendientes.length
  const titulo = `${n} dato${n > 1 ? 's' : ''} pendiente${n > 1 ? 's' : ''}`

  return (
    /* ⚠️ TARJETA ÁMBAR DEL KIT, SIN ANIMACIONES (B4 del rediseño, CALMA §28).
       Aquí hubo tres animaciones infinitas —halo, brillo y pulso— sobre un
       degradado propio; el rediseño las prohíbe (sin bucles decorativos) y el
       aviso conserva su fuerza por color, posición y por el distintivo con el
       número que `Sidebar.tsx` pinta sobre «···» y sobre el botón de menú.
       Colores: los semánticos `--aviso-*` de `sistema.css`, con su oscuro.
       Los keyframes `aviso*` de `globals.css` se quedaron sin consumidor y se
       borraron en la limpieza final (B15). */
    <div role="status" aria-live="polite" className="nav-aviso">
      <button type="button" onClick={alternar} aria-expanded={!colapsado} aria-controls={idCuerpo}
        className="nav-aviso-cabeza">
        <span aria-hidden="true" className="nav-aviso-punto"><span /></span>
        <span className="nav-aviso-titulo">{titulo}</span>
        {colapsado
          ? <ChevronDown size={16} className="ml-auto flex-none" aria-hidden="true" />
          : <ChevronUp size={16} className="ml-auto flex-none" aria-hidden="true" />}
      </button>
      {/* `hidden` y no una altura animada: animar filas de rejilla o alturas
          relayoutea en cada cuadro (PLAN §7.1). */}
      <div id={idCuerpo} hidden={colapsado} className="nav-aviso-cuerpo">
        {pendientes.map(({ clave, texto, Icono }) => (
          /* `items-start`: si «Sin cédula de especialidad» no cabe (la barra
             de `ih` mide 216), parte en dos líneas en vez de recortarse. */
          <Link key={clave} href="/perfil" onClick={alNavegar} className="nav-aviso-fila">
            <Icono size={18} className="mt-px flex-none" aria-hidden="true" />
            <span>{texto}</span>
          </Link>
        ))}
        <Link href="/perfil" onClick={alNavegar} className="nav-aviso-boton k-pulsable">
          Completar ahora
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
