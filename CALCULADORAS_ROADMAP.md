# Calculadoras Clínicas — Roadmap Técnico

**Propósito:** Sistema de 200 calculadoras y escalas médicas integrado en Spinus. Funciona en modo independiente (sin paciente) o contextual (con paciente, autocompleta y permite guardar).

**Ruta principal:** `/calculadoras-clinicas`
**Documento fuente:** `Calculadoras_Médicas_Especializadas_para_Spinus_V200.docx` (uploaded 2026-04-20)

---

## Estado actual

**Fase 2 en progreso. Sub-sesión 1 completa (10 calculadoras Tipo 1 en producción). Sub-sesión 2 pendiente: integración de 5ª card 'Calculadoras clínicas' en dashboard /estado.**

| Fase | Estado | Resultado |
|---|---|---|
| 1 — Infraestructura + IMC | ✅ Completa | IMC en producción |
| 2 — 10 calculadoras Tipo 1 | 🔄 Sub-sesión 1 completa | 10 calculadoras Tipo 1 en producción; pendiente: 5ª card en /estado |
| 3 — 20 calculadoras Tipo 2 | ⏸ Pendiente | — |
| 4 — Calculadoras Tipo 3 | ⏸ Pendiente | — |
| 5 — Calculadoras Tipo 4 | ⏸ Pendiente | — |
| 6-10 — Resto 200 | ⏸ Pendiente | — |

---

## Decisiones de producto (FINALES, no replantear)

| Aspecto | Decisión |
|---|---|
| **Scope total** | Las 200 sin excepción |
| **Orden** | Por tipo técnico (1→2→3→4), ortopédicas siguen orden natural |
| **Modo** | Híbrido: independiente desde sidebar, contextual desde dashboard |
| **Persistencia** | Por decisión del médico (botón "Guardar en expediente") |
| **UI navegación** | Dropdown por especialidad + buscador por nombre |
| **Ubicación app** | Apartado separado `/calculadoras-clinicas`, accesible desde sidebar y desde `/estado` |
| **WOMAC** | Vive como calculadora (no como métrica clínica) |

---

## Clasificación técnica (4 tipos)

### Tipo 1 — Fórmula matemática pura
Inputs numéricos → output numérico.
- Ejemplos: IMC, BSA Dubois, CKD-EPI 2021, Cockcroft-Gault, MDRD, QTc, Gradiente A-a, Brecha Aniónica, Índice de Choque, HOMA-IR
- Implementación: función pura TypeScript
- Complejidad: BAJA

### Tipo 2 — Score categórico con suma de puntos
Checkboxes o selects → suma de pesos → número + categoría de riesgo.
- Ejemplos: CHA₂DS₂-VASc, HAS-BLED, HEART, APACHE II, SOFA, CURB-65, PHQ-9, GAD-7, Wells, qSOFA, Alvarado, Centor, NEXUS
- Implementación: mapeo respuesta → peso + suma
- Complejidad: MEDIA

### Tipo 3 — Cuestionario multi-respuesta
Serie larga de preguntas con respuestas escaladas.
- Ejemplos: GCS, NIHSS, MMSE, MoCA, PANSS, HAM-D, HAM-A, DAS28, SLEDAI
- Implementación: formulario paginado con cálculo al final
- Complejidad: MEDIA-ALTA (requiere UX de cuestionario)

### Tipo 4 — Clasificación diagnóstica por criterios
Médico marca criterios → output es clasificación categórica, no número.
- Ejemplos: Criterios de Duke, Ranson, Jones, McDonald, Berlin, Roma IV, Sgarbossa, Anthonisen, Forrest, Gustilo-Anderson, Garden, Mallampati
- Implementación: árbol de decisión con lógica booleana
- Complejidad: MEDIA-ALTA

---

## Especialidades (19 total, ~10 calculadoras cada una)

1. Cardiología
2. Nefrología
3. Neumología
4. Terapia Intensiva
5. Neurología
6. Gastroenterología
7. Hematología
8. Ortopedia y Traumatología
9. Pediatría
10. Urgencias y Emergencias
11. Cirugía y Anestesia
12. Endocrinología
13. Nutrición y Metabolismo
14. Obstetricia y Ginecología
15. Psiquiatría
16. Infectología
17. Oncología
18. Reumatología
19. Dermatología

---

## Arquitectura de archivos

```
src/app/(app)/calculadoras-clinicas/
├── page.tsx                      # Hub de navegación
├── [slug]/
│   └── page.tsx                  # Calculadora individual

src/components/calculadoras/
├── CalculadoraHero.tsx
├── CalculadoraForm.tsx
├── ResultadoCard.tsx
├── GuardarExpedienteBtn.tsx      # Solo visible en modo contextual
└── EspecialidadDropdown.tsx

src/lib/calculadoras/
├── types.ts                      # Contratos TypeScript
├── categorias.ts                 # 18 especialidades con iconos + colores
├── registry.ts                   # Catálogo central de calculadoras
└── formulas/
    ├── cardiologia/
    ├── nefrologia/
    ├── ...
    └── nutricion-metabolismo/
        └── imc.ts                # Primera calculadora

src/hooks/
└── useCalculadoraContextual.ts   # Fetch paciente desde URL

supabase/migrations/
└── XXX_calculadoras_resultados.sql

src/components/expediente/dashboard/
└── CardContentCalculadoras.tsx   # 5ª card en /estado (agregar en fase futura)
```

---

## Contratos TypeScript clave

### Calculadora (el objeto core)

```typescript
type Calculadora<TInputs> = {
  slug: string                   // 'imc', 'ckd-epi-2021', 'cha2ds2-vasc'
  nombre: string                 // 'Índice de Masa Corporal'
  especialidad: EspecialidadSlug
  descripcion: string
  fuente?: string                // Referencia bibliográfica
  
  inputs: CalculadoraInput[]     // Definición de campos del formulario
  
  autocompletar?: {              // Qué datos del paciente puede jalar
    [K in keyof TInputs]?: (paciente: PacienteContexto) => TInputs[K] | undefined
  }
  
  calcular: (inputs: TInputs) => number | string
  interpretar: (resultado, inputs) => ResultadoInterpretacion
}
```

### Tipos de input

- `number` (con unidad, min, max, step)
- `select` (con opciones)
- `checkbox` (boolean)
- Futuros: `checklist`, `radio-scaled`, `date`, `text-numeric-pair`

### ResultadoInterpretacion

```typescript
{
  valor: number | string
  unidad?: string
  categoria?: string           // "Sobrepeso", "G3a", etc.
  color: 'verde' | 'amarillo' | 'rojo' | 'gris'
  texto: string                // Interpretación clínica
  observaciones?: string[]     // Bullets adicionales
}
```

---

## Schema BD

### Tabla nueva: `calculadora_resultados`

Solo esta tabla es nueva. No hay cambios en tablas existentes.

```sql
CREATE TABLE calculadora_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES usuarios(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  calculadora_slug TEXT NOT NULL,
  calculadora_nombre TEXT NOT NULL,   -- snapshot del momento
  
  inputs JSONB NOT NULL,
  resultado JSONB NOT NULL,
  
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_calc_resultados_paciente ON calculadora_resultados(paciente_id, fecha DESC);
CREATE INDEX idx_calc_resultados_clinica ON calculadora_resultados(clinica_id);
CREATE INDEX idx_calc_resultados_slug ON calculadora_resultados(calculadora_slug);

-- RLS: seguir patrón existente del repo (ver otras tablas)
ALTER TABLE calculadora_resultados ENABLE ROW LEVEL SECURITY;
-- policies por clinica_id
```

---

## Modo contextual (integración con paciente)

Cuando se navega desde `/estado` a una calculadora, se pasa `?paciente={id}` en URL.

**Flujo:**
1. `useCalculadoraContextual(pacienteId)` carga el paciente
2. Al renderizar formulario, cada input ejecuta su `autocompletar` si está definido
3. Los campos autocompletados muestran chip visual "Del paciente"
4. El médico puede sobrescribir cualquier valor
5. Al calcular, se muestra botón "Guardar en expediente"
6. Guardado inserta en `calculadora_resultados`

**Modo independiente (desde sidebar):**
- Sin `paciente_id` en URL
- Sin autocompletado
- Sin botón "Guardar"
- Puro cálculo momentáneo

---

## Fase 1 — Completada (referencia)

**Estado: ✅ Completada y en producción.**

**Entregables:**
- Tipos, categorías, registry (infraestructura)
- UI: Hero, Form dinámico, ResultadoCard, GuardarExpedienteBtn, EspecialidadDropdown
- Rutas `/calculadoras-clinicas` y `/calculadoras-clinicas/[slug]`
- Hook `useCalculadoraContextual`
- Migración SQL tabla resultados
- Link en sidebar
- **1 calculadora funcional: IMC** (Nutrición y Metabolismo)

**Criterio de éxito Fase 1:**
- Navegar desde sidebar a `/calculadoras-clinicas` → ver lista con IMC
- Click en IMC → abrir, ingresar peso+talla → ver resultado interpretado
- Navegar desde `/estado` → abrir IMC → ver peso/talla autocompletados → calcular → guardar

**Duración estimada:** 3-4 sesiones de Claude Code.

---

## Plan de fases posteriores

### Fase 2 — 10 calculadoras Tipo 1 (fórmulas puras)

1. ~~IMC~~ (hecho en Fase 1)
2. Superficie Corporal (Dubois)
3. Cockcroft-Gault
4. CKD-EPI 2021
5. MDRD
6. QTc (Bazett y Fridericia)
7. Gradiente A-a
8. Brecha Aniónica
9. Índice de Choque
10. HOMA-IR

**Duración:** 2-3 sesiones.

### Fase 3 — 20 calculadoras Tipo 2 (scores con suma)

Selección inicial: CHA₂DS₂-VASc, HAS-BLED, HEART, Wells, qSOFA, SOFA, CURB-65, Alvarado, Centor, NEXUS, PHQ-9, GAD-7, CAGE, Caprini, Apfel, Khorana, 4Ts, ASCVD, TIMI, FRAX.

**Duración:** 4-5 sesiones.

### Fase 4 — 20 calculadoras Tipo 3 (cuestionarios)

GCS, NIHSS, MMSE, MoCA, PANSS, HAM-D, HAM-A, DAS28, SLEDAI, Ballard, etc.

**Requiere extender tipos de input** (checklist, radio-scaled, multi-page form).

**Duración:** 5-6 sesiones.

### Fase 5 — 15 calculadoras Tipo 4 (criterios diagnósticos)

Duke, Ranson, Jones, McDonald, Berlin, Roma IV, Sgarbossa, Gustilo-Anderson, Garden, Mallampati, etc.

**Duración:** 4-5 sesiones.

### Fases 6-10 — Resto de 200

Distribuidas por especialidad, grupos de ~20-25 por sesión.

**Duración:** 15-20 sesiones más.

---

## Principios de implementación

### Cada calculadora es un módulo autocontenido

- Un archivo por calculadora en `src/lib/calculadoras/formulas/<especialidad>/<slug>.ts`
- Exporta un objeto `Calculadora` tipado
- Se registra agregando una línea en `src/lib/calculadoras/registry.ts`
- **Agregar una calculadora nueva = crear 1 archivo + 2 líneas en registry. Cero cambios en UI.**

### Reusabilidad

- UI genérica (CalculadoraForm) renderiza cualquier calculadora según sus `inputs`
- Agregar un tipo de input nuevo (ej. `date`, `multi-select`) se hace en un solo lugar
- `interpretar` siempre retorna el mismo shape → ResultadoCard nunca cambia

### Testing de fórmulas

Cada archivo de fórmula debe ser fácilmente testeable:
- La función `calcular` es pura (inputs → output, sin side effects)
- Se pueden agregar tests unitarios cuando se adopte Vitest en el proyecto

---

## Integración con la dashboard

**Implementar en Fase 2 o después, NO en Fase 1.**

Se agrega una 5ª card a `/estado`:

```tsx
<DashboardCard
  icon={Calculator}
  iconColor="#8b5cf6"
  title="Calculadoras clínicas"
  summary={`${calcsUsadas.length} usadas recientemente`}
>
  <CardContentCalculadoras pacienteId={id} />
</DashboardCard>
```

`CardContentCalculadoras` muestra:
- Lista de últimas calculadoras guardadas para este paciente (query a `calculadora_resultados`)
- Quick links a las más usadas por especialidad del médico
- Botón "Ver todas las calculadoras" → navega a `/calculadoras-clinicas?paciente={id}`

---

## Pendientes / decisiones diferidas

| Pendiente | Decidir cuándo |
|---|---|
| Orden exacto de 10 calculadoras en Fase 2 | Al terminar Fase 1 |
| UX de cuestionarios largos (Tipo 3) | Al arrancar Fase 4 |
| Agregar búsqueda global con ranking (no solo filter) | Si volumen de calculadoras lo justifica |
| Exportar resultado a PDF | Cuando se implementen las primeras 50 |
| Favoritos / calculadoras frecuentes del médico | Después de Fase 3 |
| Recordar últimos inputs por calculadora | Después de Fase 3 |
| Plantillas combinadas (ej. "admisión ICU" = APACHE + SOFA + qSOFA) | Después de Fase 5 |

---

## Riesgos identificados

1. **Volumen de fórmulas médicas por validar.** Cada fórmula debe implementarse con precisión clínica. Un error en CKD-EPI puede afectar dosificación de fármacos. Validar contra MDCalc u otra referencia antes de aprobar cada calculadora.

2. **UX de cuestionarios largos (Tipo 3).** GCS, NIHSS, MMSE pueden tener 15-30 preguntas. Formulario infinito es mal UX. Pensar en paginación o sidebar de progreso.

3. **Rangos contextuales (sexo/edad).** Algunas calculadoras tienen rangos distintos según sexo o edad del paciente. Tipos deben soportar esto o se resuelve en `interpretar`.

4. **Unidades alternativas.** Creatinina en mg/dL vs μmol/L. Peso en kg vs lb. Sistema debe permitir alternativas o estandarizar a sistema métrico.

---

## Referencias de consulta clínica

- [MDCalc](https://www.mdcalc.com) — referencia principal para fórmulas y criterios
- [QxMD](https://qxmd.com/calculate) — alternativa
- Literatura primaria citada en cada calculadora vía campo `fuente`

---

## Cambios de contrato / versionado

Si un contrato cambia (ej. se agrega un tipo de input nuevo), documentar aquí:

| Fecha | Cambio | Razón |
|---|---|---|
| 2026-04-20 | Creación inicial | Arranque Fase 1 |
| 2026-04-19 | Fase 2 sub-sesión 1: 10 calculadoras Tipo 1 + corrección header de especialidades 18→19 + commit inicial de infraestructura Fase 1 (no commiteada previamente) | Cierre de batch de fórmulas matemáticas puras |
