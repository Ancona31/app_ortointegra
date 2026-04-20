# Dashboard del Paciente — Resumen Técnico

**Ruta:** `/expediente/[id]/estado`
**Propósito:** Dashboard clínica del paciente. Vista centralizada de su estado actual, con arquitectura pensada para crecer.

---

## Estado actual

### Lo que está construido y pusheado a producción

| Componente | Archivo | Estado |
|---|---|---|
| Página base + layout | `src/app/(app)/expediente/[id]/estado/page.tsx` | ✅ Pusheada |
| Card reutilizable | `src/components/expediente/dashboard/DashboardCard.tsx` | ✅ Pusheada |
| Hero | `src/components/expediente/dashboard/DashboardHero.tsx` | ✅ Pusheada |
| Card datos antropométricos | `src/components/expediente/dashboard/CardContentDatos.tsx` | ✅ Pusheada |
| Card antecedentes médicos | `src/components/expediente/dashboard/CardContentAntecedentes.tsx` | ✅ Pusheada |
| Hook refactorizado de labs | `src/hooks/useLaboratoriosNormalizados.ts` | ✅ Pusheado |

### Lo que NO está construido (pausado)

- **Sesión C/D (embeber Tab* en cards 3 y 4)** — pausada indefinidamente. Los Tab* de Labs y Gráficas van a ser reemplazados cuando se ejecute la reestructuración del sistema de laboratorios (ver ROADMAP_LABORATORIOS.md cuando se cree).
- Expansión de Capa 2 (signos vitales, medicaciones, timeline, etc.)

---

## Decisiones arquitectónicas tomadas

### Layout: grid auto-fit

```tsx
<div
  className="grid gap-3"
  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
>
```

**Por qué:** agregar una card nueva no requiere cambios de CSS. El grid se acomoda automáticamente. 1 columna en mobile (<320px), 2 en tablet, 3-4 en desktop amplio.

### Cards colapsadas por default con click-to-expand

- `<DashboardCard>` maneja su propio estado `expanded` con useState interno
- Click en header alterna expanded
- Animación: `transition-[max-height] duration-300 ease-out` (CSS puro)
- Chevron rota 180° cuando expandida
- Accesibilidad: `aria-expanded` en button, `aria-hidden` en body colapsado

### iOS-strict en todo

- Timing: `cubic-bezier(0.4, 0, 0.2, 1)` o `ease-out`
- Duración: 200-300ms, nunca >400ms
- Spacing: múltiplos de 4 (4, 8, 12, 16, 20)
- Border-radius: 16px (`rounded-2xl`)
- Sombras: solo `hover:shadow-sm`, nunca pesadas
- Tipografía: heredada del body (`-apple-system`)
- CSS puro, **NO Framer Motion**
- Letter-spacing negativo en títulos display (-0.3px a -1px según tamaño)

### Datos del paciente vienen de Supabase en cliente

Patrón:
```tsx
const [paciente, setPaciente] = useState<Paciente | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(false)

useEffect(() => {
  let cancelled = false
  const supabase = createClient()
  supabase.from('pacientes').select('*').eq('id', id).single()
    .then((res: { data: Paciente | null; error: unknown }) => {
      if (cancelled) return
      if (res.error || !res.data) setError(true)
      else setPaciente(res.data)
      setLoading(false)
    })
  return () => { cancelled = true }
}, [id])
```

Loading: skeleton con `animate-pulse`. Error: mensaje + link a `/expediente`.

### Mapeos importantes

| Campo BD | Display |
|---|---|
| `sexo: 'M'` | "Masculino" |
| `sexo: 'F'` | "Femenino" |
| `sexo: 'Otro'` | "Otro" |
| `nombre + apellidos` | Se concatenan |
| `fecha_nacimiento` | Se pasa a `calcularEdad().anios` |
| `numero_expediente` | Fallback "—" si null |

### Decisión sobre layout padre

- `src/app/(app)/layout.tsx` ya aplica `pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8`
- La página no duplica padding
- Solo aplica `max-w-6xl mx-auto` para legibilidad en pantallas grandes

### Decisión sobre breadcrumb

- Inline en la página, NO usar `src/components/layout/Breadcrumbs.tsx` (estética distinta)
- Formato: `← Pacientes › {nombre completo} › Estado`
- Links a `/expediente` y `/expediente/[id]`

---

## Capa 1 (actual) — Las 4 cards

| # | Card | Icon lucide | Color | Contenido |
|---|---|---|---|---|
| 1 | Datos antropométricos | Ruler | #af52de | Peso, Talla, IMC, Teléfono (grid 2x2) |
| 2 | Antecedentes médicos | Stethoscope | var(--cp) | Patológicos, Quirúrgicos, Familiares, Medicamentos |
| 3 | Laboratorios | FlaskConical | #14b8a6 | VACÍA (pendiente reestructuración) |
| 4 | Gráficas de evolución | BarChart3 | #6366f1 | VACÍA (pendiente reestructuración) |

### CardContentDatos

Grid 2x2 con 4 stats. Cada stat:
- `bg-slate-50 rounded-xl px-4 py-3`
- Label: `text-[10px] font-semibold uppercase tracking-wider text-slate-500`
- Valor: `text-base font-semibold text-slate-900` con `font-variant-numeric: tabular-nums`
- Unidad: `text-xs text-slate-500 ml-1`
- Null values: muestra "—"

### CardContentAntecedentes

Lista vertical con 4 items. Cada item:
- Layout flex: label (w-28 shrink-0) + valor (flex-1)
- Label: `text-[11px] font-semibold uppercase tracking-wider text-slate-500`
- Valor: `text-sm text-slate-900 leading-relaxed`
- Null/empty: "Sin registro" en `text-slate-400 italic`
- Si todos vacíos: mensaje centrado "Sin antecedentes registrados"

---

## Capa 2 (futura) — Lo que vendrá

Placeholders diseñados pero NO implementados:

- **Signos vitales:** TA, FC, SpO₂, temperatura (requiere tabla `mediciones_signos_vitales`)
- **Medicaciones activas:** tratamientos en curso con dosis y frecuencia
- **Indicadores clínicos por especialidad:** WOMAC, Oswestry, VAS, etc. (parte del sistema de calculadoras clínicas que se implementa por separado)
- **Timeline clínico:** eventos, cirugías, hitos
- **Calculadoras clínicas:** quinta card con acceso rápido a las más usadas del paciente

La arquitectura actual soporta agregar cualquiera de estos como un nuevo `<DashboardCard>` en el grid sin refactor.

---

## Integración con calculadoras clínicas (futura)

Se agregará una **5ª card** "Calculadoras clínicas" que:
- Colapsada: muestra 2-3 calculadoras más usadas para el paciente + botón "Ver todas"
- Expandida: lista con las calculadoras ejecutadas en este paciente + quick access
- Click en "Ver todas" o cualquier calculadora → navega a `/calculadoras-clinicas?paciente={id}`

Esto se implementa cuando la Fase 1 del sistema de calculadoras esté estable (ver `CALCULADORAS_ROADMAP.md`).

---

## Refactor del hook de laboratorios

**Contexto:** antes vivía duplicado entre el expediente principal y lo planeado para la dashboard. Ahora es un hook compartido.

### API

```typescript
const { labs, todosLosParams, loading, error, refetch } = useLaboratoriosNormalizados(pacienteId)
```

- `labs`: array de Laboratorio[]
- `todosLosParams`: normalización compleja de analitos (61 líneas de lógica)
- `loading`, `error`: estados del fetch
- `refetch`: async function para refrescar manualmente

### Uso actual

Solo `src/app/(app)/expediente/[id]/page.tsx` lo consume. Cuando se implemente la Fase D de la dashboard (embeber Labs/Gráficas en cards), ese page también lo consumirá.

**NOTA:** Este hook será reemplazado/extendido cuando se ejecute la reestructuración del sistema de laboratorios. La normalización actual asume el esquema viejo (resultados como JSON libre). El nuevo sistema con catálogo forzado simplificará mucho esta lógica.

---

## Deuda técnica anotada

| # | Ítem | Severidad |
|---|---|---|
| 1 | Gap 16px izquierdo del main por sidebar flotante (no ajustado post-Fase 2) | Menor |
| 2 | Warning ESLint en Sidebar.tsx L147: setState síncrono en useEffect | Menor |
| 3 | Contraste pobre del footer del sidebar en zona clara del degradado | Menor |
| 4 | "Exp. —" en hero se lee raro cuando `numero_expediente` es null | Cosmético |
| 5 | `TODO` inline en useEffect del estado/page (conexión original con Supabase) ya resuelto pero deja el patrón establecido | — |
| 6 | `useLaboratoriosNormalizados` importa tipos desde `TabGraficas` (acoplamiento circular potencial) | Menor |

---

## Próximos pasos (después de la pausa actual)

La dashboard está pausada para trabajar en:
1. Sistema de calculadoras clínicas (ver `CALCULADORAS_ROADMAP.md`)
2. Reestructuración del sistema de laboratorios (pendiente crear `LABORATORIOS_ROADMAP.md`)

Cuando ambos estén construidos, se retomará la dashboard para:
- Integrar calculadoras clínicas como 5ª card
- Reemplazar las cards 3 y 4 con los nuevos componentes de Labs y Gráficas
- Expansión a Capa 2
