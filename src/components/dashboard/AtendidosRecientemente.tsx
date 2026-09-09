'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Pill, ClipboardList, RotateCw, Users } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { EncabezadoColumna, ChipAccion, AvisoColumna } from './piezasBanda2'
import { PALETA_AVATAR, ARRANQUE_AVATAR } from './paletaAvatar'

/* Cuatro tarjetas, dos por dos. La cantidad no es estética: iguala el alto de
   esta columna con el de la de documentos y evita franja vacía al pie. */
const TARJETAS = 4

/* El colchón que hay que pedir para conseguirlas. La consulta trae consultas,
   no pacientes, y un mismo paciente puede tener varias seguidas; además hay que
   descartar los que están con borrado lógico. Treinta es lo que ya pedía la
   versión anterior de esta lista. */
const LIMITE_CONSULTA = 30

type Reciente = {
  paciente_id: string
  nombre: string
  apellidos: string
  created_at: string
  detalle: string
}

type FilaConsulta = {
  paciente_id: string
  created_at: string
  motivo_consulta: string | null
  diagnosticos: { descripcion?: string }[] | null
  pacientes: { nombre: string; apellidos: string; activo?: boolean } | { nombre: string; apellidos: string; activo?: boolean }[] | null
}

export function AtendidosCargando() {
  return (
    <div>
      <EncabezadoColumna titulo="Atendidos recientemente" />
      <div className="mt-[var(--sp-gap-tiles)] grid grid-cols-2 gap-[var(--sp-gap-tiles)]">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[106px] rounded-[14px]" />)}
      </div>
    </div>
  )
}

export default function AtendidosRecientemente() {
  const { profile, loading: loadingProfile } = useProfile()
  const [recientes, setRecientes] = useState<Reciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const peticionRef = useRef(0)

  const listo = !loadingProfile && !!profile

  const cargar = useCallback(async () => {
    const mia = ++peticionRef.current
    setError(false)
    try {
      const supabase = createClient()
      const { data, error: errConsulta } = await supabase
        .from('consultas')
        /* `diagnosticos` SALE GRATIS: la fila ya se traía entera para el motivo,
           y añadir la columna al `select` no cuesta una consulta más. Es `jsonb`
           y puede venir vacío en notas antiguas; ahí se cae a `motivo_consulta`,
           que es lo que esta lista pintaba antes. */
        .select('paciente_id, created_at, motivo_consulta, diagnosticos, pacientes!inner(nombre, apellidos, activo)')
        .order('created_at', { ascending: false })
        .limit(LIMITE_CONSULTA)

      if (mia !== peticionRef.current) return
      if (errConsulta) throw errConsulta

      const vistos = new Set<string>()
      const unicos: Reciente[] = []
      for (const c of (data as FilaConsulta[] | null) ?? []) {
        const pac = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes
        if (pac?.activo === false) continue          // borrado lógico
        if (vistos.has(c.paciente_id) || unicos.length >= TARJETAS) continue
        vistos.add(c.paciente_id)
        unicos.push({
          paciente_id: c.paciente_id,
          nombre: pac?.nombre ?? '',
          apellidos: pac?.apellidos ?? '',
          created_at: c.created_at,
          detalle: c.diagnosticos?.[0]?.descripcion?.trim() || c.motivo_consulta?.trim() || '',
        })
      }
      setRecientes(unicos)
    } catch {
      /* El fallo se enseña. Antes este `catch` era silencioso y la sección
         desaparecía entera: indistinguible de «no has atendido a nadie». */
      if (mia !== peticionRef.current) return
      setError(true)
    } finally {
      if (mia === peticionRef.current) setCargando(false)
    }
  }, [])

  useEffect(() => { if (listo) void cargar() }, [listo, cargar])

  if (loadingProfile || cargando) return <AtendidosCargando />

  if (error) return (
    <div>
      <EncabezadoColumna titulo="Atendidos recientemente" />
      <AvisoColumna icono={RotateCw} mensaje="No se pudieron cargar los pacientes." onReintentar={() => { setCargando(true); void cargar() }} />
    </div>
  )

  if (recientes.length === 0) return (
    <div>
      <EncabezadoColumna titulo="Atendidos recientemente" />
      <AvisoColumna icono={Users} mensaje="Aquí aparecerán los pacientes que vayas atendiendo." enlace={{ href: '/pacientes/nuevo', texto: 'Crear paciente →' }} />
    </div>
  )

  return (
    <div>
      <EncabezadoColumna
        titulo="Atendidos recientemente"
        enlace={{ href: '/expediente', texto: 'Ver todos →' }}
      />

      {/* ⚠️ CARRUSEL EN MÓVIL, RETÍCULA DESDE `sm`. La adenda pide tarjetas de
          ancho fijo con desplazamiento horizontal en teléfono, y ese patrón no
          existía en el repo: hay `overflow-x-auto` en tablas y en un filtro de
          chips, pero ninguna retícula de tarjetas que se deslice. El mismo
          contenedor hace las dos cosas —`flex` que se desliza abajo, `grid` de
          dos columnas desde `sm`— para no duplicar el marcado de la tarjeta. */}
      <div className="mt-[var(--sp-gap-tiles)] flex gap-[var(--sp-gap-tiles)] overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible">
        {recientes.map((p, i) => {
          const iniciales = `${p.nombre[0] ?? ''}${p.apellidos[0] ?? ''}`.toUpperCase()
          /* ⚠️ POR ÍNDICE DE LA LISTA, y es lo que se busca: con cuatro
             tarjetas y cinco pares, los cuatro salen de colores distintos
             SIEMPRE. Un color derivado del paciente no lo garantiza —dos de las
             cuatro pueden caer en el mismo par— y eso se lee como un fallo. */
          const color = PALETA_AVATAR[(ARRANQUE_AVATAR.atendidos + i) % PALETA_AVATAR.length]
          return (
            <div
              key={p.paciente_id}
              className="w-[186px] shrink-0 snap-start sm:w-auto sm:shrink flex flex-col gap-[var(--sp-2)] rounded-[14px] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-pad-row-x)] py-[var(--sp-3)]"
            >
              {/* La tarjeta entera navega al expediente; los dos chips de abajo
                  quedan FUERA del enlace para que no se aniden. */}
              <Link
                href={`/expediente/${p.paciente_id}`}
                prefetch={false}
                className="flex flex-col gap-[var(--sp-2)] min-w-0 transition-opacity hover:opacity-80"
              >
                <div className="flex items-center gap-[var(--sp-2-5)] min-w-0">
                  <span
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] text-[length:var(--sp-fs-legal)] font-extrabold"
                    style={{ background: color.bg, color: color.ink }}
                  >
                    {iniciales || '?'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">
                      {p.nombre} {p.apellidos}
                    </span>
                    <span className="block truncate text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
                      {formatDistanceToNow(parseISO(p.created_at), { locale: es, addSuffix: true })}
                    </span>
                  </span>
                </div>
                {/* Diagnóstico de la última consulta, o el motivo si la nota es
                    antigua y no lo trae. UNA LÍNEA CON ELIPSIS, como el resto de
                    textos de la pantalla: a dos líneas cada tarjeta crecía 18 px
                    y la banda desbordaba el alto de un portátil. */}
                <span className="block truncate text-[length:var(--sp-fs-hint)] leading-[1.45] text-[var(--sp-ink-600)]">
                  {p.detalle || '—'}
                </span>
              </Link>

              {/* ⚠️ LOS DOS CHIPS CREAN, NO ABREN ALGO QUE YA EXISTA. No buscan
                  «la última receta» de nadie: llevan al formulario en blanco de
                  ese paciente. Por eso no hay ninguna consulta detrás. */}
              <div className="flex flex-wrap gap-[var(--sp-1-5)]">
                <ChipAccion href={`/expediente/${p.paciente_id}/documentos?tipo=receta`} icono={Pill} texto="Receta" />
                {/* ⚠️ ANTES APUNTABA A `?tab=consultas`, Y ESE PARÁMETRO NO LO
                    LEE NADIE: la página del expediente no lo consulta en ningún
                    sitio, así que el chip abría el expediente sin más y el
                    médico tenía que buscar el botón de nota a mano. Va a la nota
                    nueva, que es lo que el chip promete. */}
                <ChipAccion href={`/expediente/${p.paciente_id}/nueva-nota`} icono={ClipboardList} texto="Nota" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
