'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { BarChart2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import EstadoVacio from '@/components/ui/EstadoVacio'
import EstadoError from '@/components/ui/EstadoError'
import PestanasAdministracion from '@/components/admin/PestanasAdministracion'

type Datos = {
  consultasPorMes: { mes: string; total: number }[]
  topDiagnosticos: { nombre: string; total: number }[]
  topMedicamentos: { nombre: string; total: number }[]
  distribucionSexo: { nombre: string; total: number; color: string }[]
  distribucionEdad: { rango: string; total: number }[]
}

/* Colores de las gráficas: tokens del kit (maqueta `lectura`, vista 1), que
   siguen la marca de la clínica y el oscuro sin hex propios. La dona usa los
   tres tonos de la maqueta por posición; el `color` que trae la API se ignora
   a propósito (era un azul/rosa/morado fijo que no seguía el tema). */
const COLORES_SEXO = ['var(--accion)', 'var(--nav-tinta2)', 'var(--tinta3)']
const EJE = { fontSize: 12, fill: 'var(--tinta2)' }
const ESTILO_TOOLTIP = {
  fontSize: 12, borderRadius: 12, border: 0, background: 'var(--sup)',
  color: 'var(--tinta)', boxShadow: 'var(--sombra-capa)',
}

function Tarjeta({ titulo, ancha = false, children }: { titulo: string; ancha?: boolean; children: ReactNode }) {
  return (
    <section className={`k-tarjeta flex min-w-0 flex-col gap-3.5 ${ancha ? 'col-span-full' : ''}`}>
      <h2 className="k-t-tarjeta">{titulo}</h2>
      {children}
    </section>
  )
}

function Empty() {
  return <EstadoVacio variante="seccion" icono={BarChart2} titulo="Sin datos suficientes aún" />
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-sup px-3 py-2 text-[12px] leading-4 shadow-[var(--sombra-capa)]">
      <p className="font-medium text-tinta">{label}</p>
      <p className="k-num mt-0.5 font-bold text-enlace">{payload[0].value} {payload[0].value === 1 ? 'vez' : 'veces'}</p>
    </div>
  )
}

/* Top 10 en barras horizontales de HTML (maqueta): el nombre entero y el número
   siempre a la vista, en lugar del eje recortado a 22 caracteres y el número
   sólo al pasar el ratón. En `esc` cada fila va en una línea: nombre · barra ·
   número; en el resto, nombre y número arriba y la barra debajo. */
function Ranking({ filas }: { filas: { nombre: string; total: number }[] }) {
  const max = Math.max(1, ...filas.map(f => f.total))
  return (
    <ol className="flex flex-col gap-3 esc:gap-0">
      {filas.map(f => (
        <li key={f.nombre} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 esc:min-h-9 esc:grid-cols-[176px_minmax(0,1fr)_28px] esc:items-center esc:gap-y-0">
          <span className="text-[15px] leading-5 font-medium [overflow-wrap:anywhere] esc:text-[14px] esc:leading-[18px]">{f.nombre}</span>
          <span className="k-num text-right text-[15px] leading-5 font-bold esc:col-start-3 esc:row-start-1 esc:text-[14px]">{f.total}</span>
          <span aria-hidden="true" className="col-span-full block h-2 overflow-hidden rounded-full bg-sup2 esc:col-span-1 esc:col-start-2 esc:row-start-1">
            <span className="block h-full rounded-full bg-accion" style={{ width: `${(f.total / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  )
}

function ConsultasPorMes({ datos }: { datos: Datos['consultasPorMes'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={datos} margin={{ top: 26, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--linea)" />
        <XAxis dataKey="mes" tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--borde)' }} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--borde)' }} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--accion)"
          strokeWidth={2.5}
          fill="var(--accion)"
          fillOpacity={0.1}
          dot={{ fill: 'var(--accion)', stroke: 'var(--sup)', strokeWidth: 2, r: 5 }}
          activeDot={{ r: 7, fill: 'var(--accion)', stroke: 'var(--sup)', strokeWidth: 3 }}
        >
          <LabelList dataKey="total" position="top" offset={10} fill="var(--tinta2)" fontSize={12} fontWeight={600} />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function DistribucionSexo({ datos, total }: { datos: Datos['distribucionSexo']; total: number }) {
  return (
    <div className="flex items-center gap-4 tel:gap-7 esc:gap-7">
      <div className="relative h-[152px] w-[152px] flex-none">
        <PieChart width={152} height={152}>
          <Pie data={datos} cx="50%" cy="50%" innerRadius={52} outerRadius={74} paddingAngle={2} dataKey="total" stroke="none">
            {datos.map((_, i) => <Cell key={i} fill={COLORES_SEXO[i % COLORES_SEXO.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => [value, 'pacientes']} contentStyle={ESTILO_TOOLTIP} itemStyle={{ color: 'var(--tinta)' }} />
        </PieChart>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="k-num text-[26px] leading-7 font-extrabold tracking-[-0.5px] text-tinta">{total}</span>
          <span className="text-[12px] leading-4 font-semibold text-tinta2">pacientes</span>
        </span>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-3">
        {datos.map((s, i) => (
          <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] items-center gap-x-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORES_SEXO[i % COLORES_SEXO.length] }} />
            <p className="text-[15px] leading-5 font-semibold text-tinta">{s.nombre}</p>
            <p className="k-num col-start-2 text-[13px] leading-[18px] text-tinta2">
              {s.total} · {total > 0 ? Math.round(s.total / total * 100) : 0}%
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DistribucionEdad({ datos }: { datos: Datos['distribucionEdad'] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={datos} margin={{ top: 22, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="rango" tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--borde)' }} interval={0} />
        <YAxis hide allowDecimals={false} />
        <Tooltip formatter={(value) => [value, 'pacientes']} contentStyle={ESTILO_TOOLTIP} itemStyle={{ color: 'var(--tinta)' }} cursor={{ fill: 'var(--sup2)' }} />
        <Bar dataKey="total" fill="var(--accion)" radius={[6, 6, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="total" position="top" offset={6} fill="var(--tinta)" fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* Primera carga: la forma de la página (maqueta, estado «cargando»). */
function EsqueletoEstadisticas() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid grid-cols-1 gap-3 ih:grid-cols-2 iv:grid-cols-2 esc:grid-cols-2 esc:gap-4">
        <Skeleton className="col-span-full h-[280px] rounded-[20px]" />
        <Skeleton className="h-[320px] rounded-[20px]" />
        <Skeleton className="h-[320px] rounded-[20px]" />
      </div>
    </div>
  )
}

export default function EstadisticasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!loadingProfile && profile?.role === 'secretaria') router.push('/dashboard')
  }, [profile, loadingProfile, router])

  async function cargar(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    /* Sin red, `fetch` lanza: antes la página se quedaba en el esqueleto para
       siempre. Ahora cae en el mismo estado de error que una respuesta mala. */
    try {
      const res = await fetch('/api/me/estadisticas')
      if (res.ok) setDatos(await res.json())
    } catch { /* se queda con lo que había: error si no había nada */ }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { cargar() }, [])

  if (loadingProfile || loading) return <EsqueletoEstadisticas />

  /* Con las pestañas también en el error: «Administración» lleva aquí, y sin
     ellas no quedaría camino a Usuarios ni a Facturación (B4). «Reintentar»
     aprobado en CALMA §23.12. */
  if (!datos) return (
    <div className="mx-auto max-w-6xl">
      <PestanasAdministracion />
      <div className="k-tarjeta">
        <EstadoError mensaje="Error cargando estadísticas." alReintentar={() => cargar()} />
      </div>
    </div>
  )

  const { consultasPorMes, topDiagnosticos, topMedicamentos, distribucionSexo, distribucionEdad } = datos
  const totalPacientes = distribucionSexo.reduce((s, d) => s + d.total, 0)

  return (
    <div className="mx-auto max-w-6xl animate-slide-up">
      {/* B4: Estadísticas · Usuarios · Facturación (CALMA §30.2). */}
      <PestanasAdministracion />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="k-t-rotulo">Clínica</p>
          <h1 className="k-t-pantalla mt-0.5">Estadísticas clínicas</h1>
        </div>
        <button type="button" onClick={() => cargar(true)} disabled={refreshing} className="k-b k-b-tonal">
          <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
          Actualizar
        </button>
      </div>

      <div className={`mt-5 grid grid-cols-1 gap-3 transition-opacity duration-200 ih:grid-cols-2 ih:gap-3.5 iv:grid-cols-2 iv:gap-3.5 esc:grid-cols-2 esc:gap-4 ${refreshing ? 'opacity-45' : ''}`}>
        <Tarjeta titulo="Consultas por mes — últimos 6 meses" ancha>
          {consultasPorMes.every(c => c.total === 0) ? <Empty /> : <ConsultasPorMes datos={consultasPorMes} />}
        </Tarjeta>

        <Tarjeta titulo="Top 10 diagnósticos">
          {topDiagnosticos.length === 0 ? <Empty /> : <Ranking filas={topDiagnosticos} />}
        </Tarjeta>

        <Tarjeta titulo="Top 10 medicamentos recetados">
          {topMedicamentos.length === 0 ? <Empty /> : <Ranking filas={topMedicamentos} />}
        </Tarjeta>

        <Tarjeta titulo={`Distribución por sexo — ${totalPacientes} pacientes`}>
          {totalPacientes === 0 ? <Empty /> : <DistribucionSexo datos={distribucionSexo} total={totalPacientes} />}
        </Tarjeta>

        <Tarjeta titulo="Distribución por grupo de edad">
          {distribucionEdad.every(e => e.total === 0) ? <Empty /> : <DistribucionEdad datos={distribucionEdad} />}
        </Tarjeta>
      </div>
    </div>
  )
}
