'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  tzDispositivo, hoyEnTZ, desplazarFecha, fechaHoraLocalAInstante,
} from '@/lib/dates'
import { CabeceraTarjeta, AvisoTarjeta } from './piezasBanda2'
import { TARJETA } from './PiezasCita'

/**
 * Los tres conteos operativos de la vista de la secretaria.
 *
 * ⚠️ CADA RENGLÓN SE CAE SOLO SI SU CONTEO FALLA, y no se sustituye por un cero.
 * Lo pide el spec §3 región 6 y el motivo es que un cero es indistinguible de
 * «hoy no hay nada»: en una pantalla cuyo único propósito es decir cómo viene el
 * día, esa confusión es peor que la ausencia. `null` significa «no lo sé» y ese
 * renglón desaparece; sólo cuando fallan los tres se enseña el reintento.
 */
type Conteos = { citas: number | null; confirmadas: number | null; pacientes: number | null }

/* Los conteos como mosaicos (maqueta `dashboard-final`): número 20/700 y
   rótulo 13, sobre `--fondo` dentro de la tarjeta. Dos columnas en teléfono;
   en ancho, una fila. */
const MOSAICOS = 'mt-2 grid grid-cols-2 gap-2 ih:grid-cols-3 iv:grid-cols-3 esc:grid-cols-3'

export function HoyEnConsultorioCargando() {
  return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Hoy en el consultorio" />
      <div className={MOSAICOS} aria-hidden="true">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-[62px] rounded-[12px]" />)}
      </div>
    </section>
  )
}

function Renglon({ etiqueta, valor, acento }: { etiqueta: string; valor: number; acento?: boolean }) {
  return (
    <li className="flex min-h-[62px] flex-col justify-center rounded-[12px] bg-fondo px-3 py-2">
      {/* El número de confirmadas va en el color del estado «confirmada» del
          kit (`--tonal-tinta`, el de `IconoEstadoCita`), no en un verde propio. */}
      <span className={`k-num text-[20px] font-bold leading-6 ${acento ? 'text-tonal-tinta' : 'text-tinta'}`}>{valor}</span>
      <span className="text-[13px] leading-[18px] text-tinta2">{etiqueta}</span>
    </li>
  )
}

export default function HoyEnConsultorio() {
  const { profile, loading: loadingProfile } = useProfile()
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [cargando, setCargando] = useState(true)
  const peticionRef = useRef(0)

  const clinicaId = profile?.clinica_id ?? null

  const cargar = useCallback(async () => {
    if (!clinicaId) return
    const mia = ++peticionRef.current
    const supabase = createClient()

    /* LA REGLA de `lib/dates.ts`: las ventanas de citas se calculan en el huso
       del DISPOSITIVO de quien mira. Las TRES la comparten —las dos de hoy y la
       del mes—, y el huso va explícito en las cuatro llamadas: no hay valor por
       defecto que heredar, y ponerlo «porque compila» sería reintroducir a mano
       el bug de Sonora.
       Los dos primeros usan además los mismos filtros que `/inicio` y que la
       tarjeta de calendario: agendadas y confirmadas, y sólo citas de paciente. */
    const tz = tzDispositivo()
    const hoy = hoyEnTZ(tz)
    const inicioHoy = fechaHoraLocalAInstante(hoy, '00:00', tz)
    const inicioManana = fechaHoraLocalAInstante(desplazarFecha(hoy, { dias: 1 }), '00:00', tz)
    /* El primero del mes en curso sale de la propia fecha-solo: `YYYY-MM-01`.
       Sin inventar husos ni parsear instantes. */
    const inicioMes = fechaHoraLocalAInstante(`${hoy.slice(0, 7)}-01`, '00:00', tz)

    const citasHoy = () => supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId)
      .not('paciente_id', 'is', null)
      .gte('start_time', inicioHoy)
      .lt('start_time', inicioManana)

    const uno = async (q: PromiseLike<{ count: number | null }>) => {
      try { return (await q).count ?? 0 } catch { return null }
    }

    try {
      const [citas, confirmadas, pacientes] = await Promise.all([
        uno(citasHoy().in('status', ['scheduled', 'confirmed'])),
        uno(citasHoy().eq('status', 'confirmed')),
        uno(supabase
          .from('pacientes')
          .select('id', { count: 'exact', head: true })
          .eq('clinica_id', clinicaId)
          .neq('activo', false)
          .gte('created_at', inicioMes)),
      ])
      if (mia !== peticionRef.current) return
      setConteos({ citas, confirmadas, pacientes })
    } catch {
      /* `uno()` ya devuelve `null` por conteo fallido, así que aquí sólo cae un
         fallo del propio `Promise.all`. Los tres a null = el aviso de abajo. */
      if (mia !== peticionRef.current) return
      setConteos({ citas: null, confirmadas: null, pacientes: null })
    } finally {
      if (mia === peticionRef.current) setCargando(false)
    }
  }, [clinicaId])

  /* Mismo guarda que el resto de las regiones: el efecto no arranca hasta que
     hay perfil, y así no dispara una consulta con `clinica_id` vacío. */
  const listo = !loadingProfile && !!clinicaId
  useEffect(() => { if (listo) void cargar() }, [listo, cargar])

  if (loadingProfile || cargando) return <HoyEnConsultorioCargando />

  const nada = !conteos || (conteos.citas === null && conteos.confirmadas === null && conteos.pacientes === null)
  if (nada) return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Hoy en el consultorio" />
      <AvisoTarjeta icono={RotateCw} mensaje="No se pudieron cargar los conteos." onReintentar={() => { setCargando(true); void cargar() }} />
    </section>
  )

  return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Hoy en el consultorio" />
      <ul className={MOSAICOS}>
        {conteos.citas !== null && <Renglon etiqueta="Citas de hoy" valor={conteos.citas} />}
        {conteos.confirmadas !== null && <Renglon etiqueta="Confirmadas" valor={conteos.confirmadas} acento />}
        {conteos.pacientes !== null && <Renglon etiqueta="Pacientes registrados este mes" valor={conteos.pacientes} />}
      </ul>
    </section>
  )
}
