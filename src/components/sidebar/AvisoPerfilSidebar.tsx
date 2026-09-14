'use client'

import Link from 'next/link'
import { useId, useSyncExternalStore } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, FileBadge, ImageIcon, PenLine } from 'lucide-react'

/**
 * El aviso de perfil incompleto del sidebar — variante 2a del handoff de diseño.
 *
 * Sustituye al tratamiento discreto anterior (listón ámbar sobre `bg-white/5`),
 * que se leía como nota al pie y no comunicaba urgencia. Ahora es una tarjeta
 * ámbar sólida, colapsable, con tres animaciones perpetuas.
 *
 * ⚠️ LAS TRES ANIMACIONES SON INFINITAS A PROPÓSITO, Y NO SON ADORNO. El aviso
 * tiene que seguir llamando la atención hasta que el perfil esté completo: un
 * médico que no se entera de que le falta la firma acaba pensando que los
 * documentos salen mal y levanta un ticket. Los keyframes viven en
 * `globals.css` junto a los demás del proyecto, con `prefers-reduced-motion`
 * apagándolos.
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

/* El degradado y la sombra de elevación van por `style` y no por clase
   arbitraria: es el patrón que ya usa el `aside` de `Sidebar.tsx` para su navy,
   y se lee mejor que una arbitraria con comas y paréntesis. */
const FONDO_TARJETA = 'linear-gradient(180deg,#FFC53D 0%,#F0A81E 100%)'
const SOMBRA_TARJETA = '0 8px 20px rgba(240,168,30,.35)'
const FONDO_BRILLO =
  'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.5),rgba(255,255,255,0))'

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
    /* El halo vive en este envoltorio para no comerse la sombra de elevación de
       la tarjeta — ver la nota de `globals.css`. */
    <div className="animate-aviso-halo mt-[14px] rounded-[12px]">
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden rounded-[12px]"
        /* `containerType` es lo que convierte a la tarjeta en la unidad de
           medida del brillo (`100cqw` en `avisoSheen`). Va aquí y no como
           utilidad para no depender de que el `@container` de Tailwind se
           emita; el objeto de estilo ya existía. Su ancho viene del padre, no
           del contenido, así que la contención en línea no cambia nada. */
        style={{ background: FONDO_TARJETA, boxShadow: SOMBRA_TARJETA, containerType: 'inline-size' }}
      >
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!colapsado}
          aria-controls={idCuerpo}
          className="relative flex w-full items-center gap-[9px] overflow-hidden px-[11px] py-3 text-left"
        >
          <span
            aria-hidden="true"
            /* `left-0`: sin él la banda arranca en su posición estática —tras
               el relleno del botón— y el recorrido calculado no cuadraría con
               el borde de la tarjeta. */
            className="animate-aviso-sheen pointer-events-none absolute inset-y-0 left-0 w-[38px]"
            style={{ background: FONDO_BRILLO }}
          />
          <span
            aria-hidden="true"
            className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px] bg-[#7A4A00]"
          >
            <span className="animate-aviso-pulse block h-2 w-2 rounded-full bg-[#FFD66B]" />
          </span>
          <span className="text-[14px] font-bold tracking-[.02em] text-[#3D2400]">{titulo}</span>
          {colapsado
            ? <ChevronDown size={12} className="ml-auto flex-none text-[#4A2C00]" aria-hidden="true" />
            : <ChevronUp size={12} className="ml-auto flex-none text-[#4A2C00]" aria-hidden="true" />}
        </button>

        <div
          id={idCuerpo}
          className={`aviso-perfil-colapso grid ${colapsado ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-[11px] pb-[13px]">
              <div className="mb-[11px] h-px bg-[rgba(74,44,0,.22)]" />

              <div className="flex flex-col gap-[7px]">
                {pendientes.map(({ clave, texto, Icono }) => (
                  /* ⚠️ `items-start` Y `leading-snug` SON LA RED DEL ANCHO. La
                     spec supone un sidebar de 300px y éste es de 256: a «Sin
                     cédula de especialidad» le quedan ~183px para ~173 de texto,
                     y la fuente del sidebar es `system-ui` —más ancha en Linux
                     que la Segoe/SF del cálculo—. Si no cabe, parte en dos
                     líneas en vez de recortarse: el significado sobrevive. Por
                     lo mismo el relleno horizontal es de 11px y no de 13, que
                     también está en la escala de la spec. */
                  <Link
                    key={clave}
                    href="/perfil"
                    onClick={alNavegar}
                    className="flex items-start gap-2 rounded-[4px] text-[14px] font-semibold leading-snug text-[#3D2400] transition-colors duration-[120ms] hover:text-[#7A4A00] focus-visible:[outline:2px_solid_#4A2C00] focus-visible:outline-offset-2"
                  >
                    <Icono size={15} className="mt-px w-[15px] flex-none" aria-hidden="true" />
                    <span>{texto}</span>
                  </Link>
                ))}
              </div>

              <Link
                href="/perfil"
                onClick={alNavegar}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-[#4A2C00] py-[10px] text-[14px] font-bold text-[#FFE9B8] transition-colors hover:bg-[#301C00] active:translate-y-px"
              >
                Completar ahora
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
