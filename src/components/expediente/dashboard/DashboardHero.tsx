'use client'

type DashboardHeroProps = {
  nombre: string
  edad: number | null
  sexo: string
  expediente: string
}

export default function DashboardHero({ nombre, edad, sexo, expediente }: DashboardHeroProps) {
  return (
    <header className="mb-8">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        Dashboard del paciente
      </div>
      <h1
        className="text-[36px] font-bold text-slate-900"
        style={{ letterSpacing: '-1px' }}
      >
        {nombre}
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        {edad !== null && (
          <>
            <span className="font-medium text-slate-600">{edad} años</span>
            {' · '}
          </>
        )}
        {sexo}
        {' · '}
        Exp. {expediente}
      </p>
    </header>
  )
}
