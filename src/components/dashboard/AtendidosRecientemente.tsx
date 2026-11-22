'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Pill, ClipboardList, RotateCw, Users } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { CabeceraTarjeta, ChipAccion, AvisoTarjeta } from './piezasBanda2'
import Avatar, { ARRANQUE_AVATAR, inicialesDe } from '@/components/ui/Avatar'
import { TARJETA } from './PiezasCita'

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

/* En teléfono (ext/tel) la lista es un carrusel de tarjetas con snap, sin
   tarjeta alrededor (CALMA §3: nada de caja dentro de caja); en ancho, una
   tarjeta con filas. */
const MARCO = `${TARJETA} ext:bg-transparent ext:p-0 tel:bg-transparent tel:p-0`
const PISTA = 'mt-2 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 ih:flex-col ih:gap-0 ih:overflow-visible iv:flex-col iv:gap-0 iv:overflow-visible esc:flex-col esc:gap-0 esc:overflow-visible'
const PIEZA = 'flex w-[236px] shrink-0 snap-start flex-col gap-3 rounded-[16px] bg-sup p-4 ' +
  'ih:w-auto ih:rounded-none ih:bg-transparent ih:px-0 ih:py-3 ih:border-t ih:border-linea ih:first:border-t-0 ' +
  'iv:w-auto iv:rounded-none iv:bg-transparent iv:px-0 iv:py-3 iv:border-t iv:border-linea iv:first:border-t-0 ' +
  'esc:w-auto esc:flex-row esc:items-center esc:rounded-none esc:bg-transparent esc:px-0 esc:py-3 esc:border-t esc:border-linea esc:first:border-t-0'

export function AtendidosCargando() {
  return (
    <section className={MARCO}>
      <CabeceraTarjeta titulo="Atendidos recientemente" />
      <div className={PISTA} aria-hidden="true">
        {[1, 2].map(i => <div key={i} className={`${PIEZA} skeleton h-[106px] esc:h-[60px] ih:h-[60px] iv:h-[60px]`} />)}
      </div>
    </section>
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
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Atendidos recientemente" />
      <AvisoTarjeta icono={RotateCw} mensaje="No se pudieron cargar los pacientes." onReintentar={() => { setCargando(true); void cargar() }} />
    </section>
  )

  if (recientes.length === 0) return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Atendidos recientemente" />
      <AvisoTarjeta icono={Users} mensaje="Aquí aparecerán los pacientes que vayas atendiendo." enlace={{ href: '/pacientes/nuevo', texto: 'Crear paciente →' }} />
    </section>
  )

  return (
    <section className={MARCO}>
      <CabeceraTarjeta titulo="Atendidos recientemente" enlace={{ href: '/expediente', texto: 'Ver todos →' }} />
      <ul className={PISTA}>
        {recientes.map((p, i) => {
          const nombre = `${p.nombre} ${p.apellidos}`
          return (
            <li key={p.paciente_id} className={PIEZA}>
              {/* La fila entera navega al expediente; los dos chips quedan FUERA
                  del enlace para que no se aniden. Avatar por índice de la lista
                  (`ARRANQUE_AVATAR`): las cuatro salen de colores distintos. */}
              <Link href={`/expediente/${p.paciente_id}`} prefetch={false}
                className="k-pulsable flex min-w-0 flex-1 items-center gap-3">
                <Avatar texto={inicialesDe(p.nombre, p.apellidos)} indice={i} arranque={ARRANQUE_AVATAR.atendidos} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-5 text-tinta">{nombre}</span>
                  {/* Diagnóstico de la última consulta (o el motivo, en notas
                      antiguas) y cuándo. Una línea con elipsis. */}
                  <span className="block truncate text-[13px] leading-[18px] text-tinta2">
                    {p.detalle || '—'} · {formatDistanceToNow(parseISO(p.created_at), { locale: es, addSuffix: true })}
                  </span>
                </span>
              </Link>
              {/* ⚠️ LOS DOS CHIPS CREAN, NO ABREN ALGO QUE YA EXISTA: llevan al
                  formulario en blanco de ese paciente. La nota va a la nota
                  nueva (`?tab=consultas` no lo leía nadie). */}
              <div className="flex shrink-0 flex-wrap gap-1.5 ih:pl-12 iv:pl-12">
                <ChipAccion href={`/expediente/${p.paciente_id}/documentos?tipo=receta`} icono={Pill} texto="Receta" etiqueta={`Receta de ${nombre}`} />
                <ChipAccion href={`/expediente/${p.paciente_id}/nueva-nota`} icono={ClipboardList} texto="Nota" etiqueta={`Nota de ${nombre}`} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
