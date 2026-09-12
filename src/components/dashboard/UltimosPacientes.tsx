'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CalendarPlus, RotateCw, UserPlus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { calcularEdad } from '@/lib/patientUtils'
import { EncabezadoColumna, ChipAccion, AvisoColumna } from './piezasBanda2'
import { PALETA_AVATAR, ARRANQUE_AVATAR } from './paletaAvatar'

/** Cuatro tarjetas, dos por dos, como la columna equivalente del médico. */
const TARJETAS = 4

type Reciente = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  created_at: string | null
}

export function UltimosPacientesCargando() {
  return (
    <div>
      <EncabezadoColumna titulo="Últimos pacientes registrados" />
      <div className="mt-[var(--sp-gap-tiles)] grid grid-cols-2 gap-[var(--sp-gap-tiles)]">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[106px] rounded-[14px]" />)}
      </div>
    </div>
  )
}

export default function UltimosPacientes() {
  const { profile, loading: loadingProfile } = useProfile()
  const [pacientes, setPacientes] = useState<Reciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const peticionRef = useRef(0)

  const listo = !loadingProfile && !!profile

  const cargar = useCallback(async () => {
    const mia = ++peticionRef.current
    setError(false)
    try {
      const supabase = createClient()
      /* Sólo los campos que la tarjeta pinta. La versión anterior traía
         `select('*')` de la fila entera de `pacientes` —expediente incluido— a
         una pantalla que por rol NO puede enseñar nada clínico. */
      const { data, error: errConsulta } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos, fecha_nacimiento, created_at')
        .neq('activo', false)
        .order('created_at', { ascending: false })
        .limit(TARJETAS)

      if (mia !== peticionRef.current) return
      if (errConsulta) throw errConsulta
      setPacientes((data as Reciente[] | null) ?? [])
    } catch {
      if (mia !== peticionRef.current) return
      setError(true)
    } finally {
      if (mia === peticionRef.current) setCargando(false)
    }
  }, [])

  useEffect(() => { if (listo) void cargar() }, [listo, cargar])

  if (loadingProfile || cargando) return <UltimosPacientesCargando />

  if (error) return (
    <div>
      <EncabezadoColumna titulo="Últimos pacientes registrados" />
      <AvisoColumna icono={RotateCw} mensaje="No se pudieron cargar los pacientes." onReintentar={() => { setCargando(true); void cargar() }} />
    </div>
  )

  if (pacientes.length === 0) return (
    <div>
      <EncabezadoColumna titulo="Últimos pacientes registrados" />
      <AvisoColumna icono={UserPlus} mensaje="Aquí aparecerán los pacientes que registres." enlace={{ href: '/pacientes/nuevo', texto: '+ Nuevo paciente' }} />
    </div>
  )

  return (
    <div>
      {/* ⚠️ SIN «VER TODOS», Y NO ES UN OLVIDO. Su destino natural sería
          `/expediente`, que la barra lateral sí le da a este rol como listado de
          pacientes; pero el encargo cierra la vista con «nada clínico, sin
          expediente» y «la única acción sobre un paciente es Agendar», y un
          enlace rotulado así en una tarjeta de paciente se lee como acceso al
          expediente clínico. El listado sigue a un clic, en el menú. */}
      <EncabezadoColumna titulo="Últimos pacientes registrados" />

      <div className="mt-[var(--sp-gap-tiles)] flex gap-[var(--sp-gap-tiles)] overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible">
        {pacientes.map((p, i) => {
          const iniciales = `${p.nombre[0] ?? ''}${p.apellidos[0] ?? ''}`.toUpperCase()
          const color = PALETA_AVATAR[(ARRANQUE_AVATAR.atendidos + i) % PALETA_AVATAR.length]
          const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
          return (
            <div
              key={p.id}
              className="w-[186px] shrink-0 snap-start sm:w-auto sm:shrink flex flex-col gap-[var(--sp-2)] rounded-[14px] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-pad-row-x)] py-[var(--sp-3)]"
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
                  {/* Edad y fecha de alta. NADA CLÍNICO: ni diagnóstico, ni
                      motivo, ni última consulta — es la frontera del rol. */}
                  <span className="block truncate text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
                    {edad !== null ? `${edad.textoElegante} · ` : ''}
                    {p.created_at ? format(parseISO(p.created_at), 'd MMM yyyy', { locale: es }) : ''}
                  </span>
                </span>
              </div>

              {/* ⚠️ LA ÚNICA ACCIÓN SOBRE UN PACIENTE EN ESTA VISTA. No añadas
                  expediente, receta ni nota: el rol no los tiene. Usa el enlace
                  profundo del bloque 6, que abre el modal de alta de la agenda
                  con este paciente ya puesto. */}
              <div className="flex flex-wrap gap-[var(--sp-1-5)]">
                <ChipAccion href={`/agenda?cita=nueva&paciente=${p.id}`} icono={CalendarPlus} texto="Agendar" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
