'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CalendarPlus, RotateCw, UserPlus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { calcularEdad } from '@/lib/patientUtils'
import { CabeceraTarjeta, ChipAccion, AvisoTarjeta } from './piezasBanda2'
import Avatar, { ARRANQUE_AVATAR, inicialesDe } from '@/components/ui/Avatar'
import { TARJETA } from './PiezasCita'

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
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Últimos pacientes registrados" />
      <div className="mt-1 flex flex-col" aria-hidden="true">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton my-2 h-10 rounded-[10px]" />)}
      </div>
    </section>
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
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Últimos pacientes registrados" />
      <AvisoTarjeta icono={RotateCw} mensaje="No se pudieron cargar los pacientes." onReintentar={() => { setCargando(true); void cargar() }} />
    </section>
  )

  if (pacientes.length === 0) return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Últimos pacientes registrados" />
      <AvisoTarjeta icono={UserPlus} mensaje="Aquí aparecerán los pacientes que registres." enlace={{ href: '/pacientes/nuevo', texto: '+ Nuevo paciente' }} />
    </section>
  )

  return (
    <section className={TARJETA}>
      {/* ⚠️ SIN «VER TODOS», Y NO ES UN OLVIDO. Su destino natural sería
          `/expediente`, que la barra lateral sí le da a este rol como listado de
          pacientes; pero el encargo cierra la vista con «nada clínico, sin
          expediente» y «la única acción sobre un paciente es Agendar», y un
          enlace rotulado así en una tarjeta de paciente se lee como acceso al
          expediente clínico. El listado sigue a un clic, en el menú. */}
      <CabeceraTarjeta titulo="Últimos pacientes registrados" />
      <ul className="k-lista mt-1">
        {pacientes.map((p, i) => {
          const nombre = `${p.nombre} ${p.apellidos}`
          const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
          return (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-2.5">
              <Avatar texto={inicialesDe(p.nombre, p.apellidos)} indice={i} arranque={ARRANQUE_AVATAR.atendidos} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-5 text-tinta">{nombre}</span>
                {/* Edad y fecha de alta. NADA CLÍNICO: ni diagnóstico, ni
                    motivo, ni última consulta — es la frontera del rol. */}
                <span className="block truncate text-[13px] leading-[18px] text-tinta2">
                  {edad !== null ? `${edad.textoElegante} · ` : ''}
                  {p.created_at ? format(parseISO(p.created_at), 'd MMM yyyy', { locale: es }) : ''}
                </span>
              </span>
              {/* ⚠️ LA ÚNICA ACCIÓN SOBRE UN PACIENTE EN ESTA VISTA. No añadas
                  expediente, receta ni nota: el rol no los tiene. Abre el modal
                  de alta de la agenda con este paciente ya puesto. */}
              <ChipAccion href={`/agenda?cita=nueva&paciente=${p.id}`} icono={CalendarPlus} texto="Agendar" etiqueta={`Agendar cita a ${nombre}`} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
