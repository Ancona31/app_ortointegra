# Módulo Pediátrico — Roadmap Técnico

**Propósito:** Sistema completo de seguimiento longitudinal pediátrico (0-18 años) integrado en Spinus. Incluye registro antropométrico, hitos del desarrollo, percentiles según tablas OMS+CDC, gráficas de crecimiento, y calculadoras pediátricas.

**Rutas principales:**
- `/expediente/[id]/pediatria` — Módulo longitudinal de seguimiento (vinculado al paciente)
- `/calculadoras-clinicas/pediatria/[slug]` — Calculadoras pediátricas puntuales (sin contexto de paciente requerido)

---

## Estado actual

**No iniciado.** Documento creado el 2026-04-20.

| Sub-fase | Estado |
|---|---|
| 1. Infraestructura BD + tipos | ⏸ Pendiente |
| 2. Datasets OMS + CDC | ⏸ Pendiente |
| 3. Captura de mediciones | ⏸ Pendiente |
| 4. Hitos del desarrollo | ⏸ Pendiente |
| 5. Curvas de crecimiento | ⏸ Pendiente |
| 6. Vista principal e integración | ⏸ Pendiente |

---

## Decisiones de producto (FINALES, no replantear)

| Aspecto | Decisión |
|---|---|
| **Arquitectura** | Separación entre seguimiento longitudinal (en expediente) y calculadoras puntuales (en módulo de calculadoras) |
| **Ruta longitudinal** | `/expediente/[id]/pediatria` — módulo dentro del expediente del paciente |
| **Ruta calculadoras** | `/calculadoras-clinicas/pediatria/[slug]` — siguiendo patrón existente |
| **Estándar percentiles** | Selector manual por gráfica: OMS (0-5 años recomendado), CDC (2-20 años recomendado), o el que el médico decida |
| **Hitos del desarrollo** | Catálogo CDC completo 2022 con los 5 dominios: motor grueso, motor fino, lenguaje, cognitivo, social-emocional |
| **Scope V1** | Completo (no recortar) |

---

## Arquitectura técnica

### Tablas nuevas en Supabase

#### Tabla 1: `mediciones_pediatricas`

```sql
CREATE TABLE mediciones_pediatricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  fecha_medicion DATE NOT NULL,
  edad_meses INT NOT NULL,             -- snapshot al momento de la medición
  
  -- Antropometría (todos opcionales: el médico mide lo que necesita)
  peso_kg NUMERIC(5,3),                -- ej. 12.450 (3 decimales para neonatos)
  talla_cm NUMERIC(5,2),
  perimetro_cefalico_cm NUMERIC(5,2),
  perimetro_abdominal_cm NUMERIC(5,2),
  perimetro_toracico_cm NUMERIC(5,2),  -- relevante en neonatos
  
  -- IMC calculado al guardar
  imc NUMERIC(4,2),
  
  -- Z-scores y percentiles (calculados al guardar)
  z_peso_edad NUMERIC(4,2),
  z_talla_edad NUMERIC(4,2),
  z_peso_talla NUMERIC(4,2),
  z_imc_edad NUMERIC(4,2),
  z_pc_edad NUMERIC(4,2),
  
  percentil_peso_edad INT,
  percentil_talla_edad INT,
  percentil_pc_edad INT,
  percentil_imc_edad INT,
  
  estandar_referencia TEXT NOT NULL,   -- 'OMS' | 'CDC'
  
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_med_pediatricas_paciente ON mediciones_pediatricas(paciente_id, fecha_medicion DESC);
CREATE INDEX idx_med_pediatricas_clinica ON mediciones_pediatricas(clinica_id);

ALTER TABLE mediciones_pediatricas ENABLE ROW LEVEL SECURITY;
-- Policy con get_clinica_id() patrón existente
```

#### Tabla 2: `hitos_desarrollo_pediatrico`

```sql
CREATE TABLE hitos_desarrollo_pediatrico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  hito_codigo TEXT NOT NULL,           -- ej. 'sostiene_cabeza', 'camina_solo'
  fecha_alcanzado DATE,                -- null si todavía no
  edad_meses_alcanzado INT,            -- snapshot
  
  estado TEXT NOT NULL CHECK (estado IN ('alcanzado', 'en_proceso', 'no_alcanzado', 'no_evaluado')),
  notas TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (paciente_id, hito_codigo)    -- un solo registro por hito por paciente
);

CREATE INDEX idx_hitos_paciente ON hitos_desarrollo_pediatrico(paciente_id);
CREATE INDEX idx_hitos_clinica ON hitos_desarrollo_pediatrico(clinica_id);

ALTER TABLE hitos_desarrollo_pediatrico ENABLE ROW LEVEL SECURITY;
```

### Estructura de archivos

```
src/app/(app)/expediente/[id]/pediatria/
└── page.tsx                              # Vista principal del módulo

src/components/pediatria/
├── PediatriaHero.tsx                     # Header con edad exacta + ult. medición
├── NuevaMedicionForm.tsx                 # Captura de antropometría
├── MedicionesHistorial.tsx               # Tabla de mediciones
├── MedicionRow.tsx                       # Fila individual editable
├── HitosDesarrolloGrid.tsx               # Grid de hitos por dominio
├── HitoCard.tsx                          # Card individual de hito
├── HitoDominioSection.tsx                # Sección de un dominio
├── CurvasCrecimiento.tsx                 # Gráfica de percentiles
├── SelectorEstandar.tsx                  # OMS / CDC toggle
├── CardUltimaMedicion.tsx                # Card de dashboard
├── CardCurvasCrecimiento.tsx             # Card de dashboard
├── CardHitosDesarrollo.tsx               # Card de dashboard
└── CardCalculadorasPediatricas.tsx       # Card con quick access

src/lib/pediatria/
├── types.ts                              # Tipos TypeScript
├── edad-utils.ts                         # Cálculos de edad (años/meses/días)
├── percentiles.ts                        # Función calcularPercentil(LMS)
├── hitos-catalogo.ts                     # Catálogo CDC completo
├── alertas-hitos.ts                      # Lógica de detección de retrasos
└── datasets/
    ├── oms_0_5_peso_edad_M.json          # Parámetros LMS por edad
    ├── oms_0_5_peso_edad_F.json
    ├── oms_0_5_talla_edad_M.json
    ├── oms_0_5_talla_edad_F.json
    ├── oms_0_5_pc_edad_M.json
    ├── oms_0_5_pc_edad_F.json
    ├── oms_0_5_peso_talla_M.json
    ├── oms_0_5_peso_talla_F.json
    ├── oms_0_5_imc_edad_M.json
    ├── oms_0_5_imc_edad_F.json
    ├── cdc_2_20_peso_edad_M.json
    ├── cdc_2_20_peso_edad_F.json
    ├── cdc_2_20_talla_edad_M.json
    ├── cdc_2_20_talla_edad_F.json
    ├── cdc_2_20_imc_edad_M.json
    └── cdc_2_20_imc_edad_F.json

supabase/migrations/                       (raíz del repo, según convención)
├── supabase_migration_pediatria_mediciones.sql
└── supabase_migration_pediatria_hitos.sql
```

### Estructura conceptual de un dataset LMS

```typescript
// Ejemplo: oms_0_5_peso_edad_M.json
{
  "estandar": "OMS",
  "variable": "peso_edad",
  "sexo": "M",
  "rango_edad_meses": [0, 60],
  "fuente": "WHO Multicentre Growth Reference Study Group, 2006",
  "datos": [
    { "edad_meses": 0, "L": 0.3487, "M": 3.3464, "S": 0.14602 },
    { "edad_meses": 1, "L": 0.2297, "M": 4.4709, "S": 0.13395 },
    // ... una entrada por mes hasta 60
  ]
}
```

### Función núcleo: cálculo de percentil con LMS

```typescript
// src/lib/pediatria/percentiles.ts
export function calcularPercentil(
  valor: number,
  edad_meses: number,
  sexo: 'M' | 'F',
  variable: 'peso_edad' | 'talla_edad' | 'pc_edad' | 'imc_edad' | 'peso_talla',
  estandar: 'OMS' | 'CDC'
): { z_score: number; percentil: number } {
  // 1. Cargar dataset según variable + sexo + estandar
  // 2. Buscar interpolar entre meses adyacentes los parámetros LMS
  // 3. Aplicar fórmula LMS para Z-score:
  //    Z = ((valor/M)^L - 1) / (L*S)   si L != 0
  //    Z = ln(valor/M) / S              si L == 0
  // 4. Convertir Z-score a percentil con CDF normal estándar
}
```

---

## Catálogo de hitos del desarrollo (CDC 2022)

Catálogo estático en `src/lib/pediatria/hitos-catalogo.ts`. Estructura:

```typescript
export type HitoDesarrollo = {
  codigo: string                                  // 'sostiene_cabeza'
  nombre: string                                  // 'Sostiene la cabeza'
  dominio: 'motor_grueso' | 'motor_fino' | 'lenguaje' | 'cognitivo' | 'social_emocional'
  edad_esperada_min_meses: number                 // ej. 2
  edad_esperada_max_meses: number                 // ej. 4
  edad_limite_alarma_meses: number                // ej. 6 (si no se alcanza, red flag)
  descripcion?: string
  fuente: string                                  // 'CDC Developmental Milestones 2022'
}
```

### Hitos por edad y dominio (referencia para implementación)

**2 meses:**
- Sonrisa social (social-emocional)
- Vocaliza sonidos guturales (lenguaje)
- Sigue objetos con la vista (cognitivo)
- Sostiene la cabeza brevemente boca abajo (motor grueso)

**4 meses:**
- Ríe a carcajadas (social-emocional)
- Balbucea (lenguaje)
- Reconoce caras familiares (cognitivo)
- Sostiene la cabeza con firmeza (motor grueso)
- Lleva manos a la línea media (motor fino)

**6 meses:**
- Reconoce caras familiares (social-emocional)
- Responde a su nombre (lenguaje)
- Curiosidad por objetos lejanos (cognitivo)
- Se da vuelta en ambos sentidos (motor grueso)
- Transfiere objetos de mano a mano (motor fino)

**9 meses:**
- Ansiedad ante extraños (social-emocional)
- Dice "mamá", "papá" (sin significado específico) (lenguaje)
- Busca objetos escondidos (cognitivo)
- Se sienta sin apoyo (motor grueso)
- Pinza inferior (cubital) (motor fino)

**12 meses:**
- Juega "tortillitas" (social-emocional)
- Primeras palabras con significado (lenguaje)
- Imita gestos (cognitivo)
- Camina con apoyo o solo (motor grueso)
- Pinza superior (digital) (motor fino)

**15 meses:**
- Muestra afecto (social-emocional)
- Vocabulario de 3-5 palabras (lenguaje)
- Sigue instrucciones simples (cognitivo)
- Camina solo con confianza (motor grueso)
- Construye torres de 2 cubos (motor fino)

**18 meses:**
- Juego paralelo (social-emocional)
- Vocabulario de 10+ palabras (lenguaje)
- Señala partes del cuerpo (cognitivo)
- Sube escaleras con apoyo (motor grueso)
- Garabatea (motor fino)

**24 meses:**
- Imita conducta de adultos (social-emocional)
- Frases de 2 palabras (lenguaje)
- Clasifica objetos por forma/color (cognitivo)
- Corre, salta con ambos pies (motor grueso)
- Construye torres de 6 cubos (motor fino)

**3 años:**
- Juego cooperativo simple (social-emocional)
- Frases de 3+ palabras, oraciones completas (lenguaje)
- Cuenta hasta 3 (cognitivo)
- Salta con un solo pie (motor grueso)
- Copia círculos (motor fino)

**4 años:**
- Comparte y coopera (social-emocional)
- Cuenta historias simples (lenguaje)
- Reconoce colores básicos (cognitivo)
- Salta en un pie (motor grueso)
- Dibuja persona con 3 partes (motor fino)

**5 años:**
- Sigue reglas de juego (social-emocional)
- Cuenta hasta 10 (lenguaje/cognitivo)
- Conoce las 4 estaciones (cognitivo)
- Brinca alternando pies (motor grueso)
- Escribe su nombre (motor fino)

**Catálogo completo a construir:** ~80-100 hitos cubriendo de 0 a 60 meses, más hitos selectos hasta los 12 años (lectura fluida, escritura, matemáticas básicas, etc.).

---

## Sub-fases de implementación

### Sub-fase 1 — Infraestructura BD + tipos

**Entregables:**
- 2 migraciones SQL (mediciones + hitos) con RLS según patrón existente
- `src/types/pediatria.ts` con tipos completos
- `src/lib/pediatria/edad-utils.ts` con funciones:
  - `calcularEdadDetallada(fechaNacimiento)` → `{ años, meses, días, total_meses }`
  - `formatearEdad(detallada)` → string legible "2 años 3 meses"
- `src/lib/pediatria/hitos-catalogo.ts` con TODOS los hitos CDC documentados
- Sin UI todavía

**Sesiones estimadas:** 2

### Sub-fase 2 — Datasets OMS + CDC

**Trabajo de datos (NO solo código):**
- Descargar datasets oficiales:
  - WHO Child Growth Standards: https://www.who.int/tools/child-growth-standards
  - CDC Growth Charts: https://www.cdc.gov/growthcharts/percentile_data_files.htm
- Procesar Excel/CSV oficiales a JSON con formato definido arriba
- Datasets necesarios: ~16 archivos JSON (OMS y CDC × ambos sexos × 5 variables principales)

**Código:**
- `src/lib/pediatria/percentiles.ts` con función `calcularPercentil()`
- Tests unitarios contra valores conocidos publicados por OMS/CDC

**Sesiones estimadas:** 2-3

### Sub-fase 3 — Captura de mediciones

**Componentes UI:**
- `<NuevaMedicionForm>` con todos los inputs antropométricos (todos opcionales)
- Cálculo automático IMC al ingresar peso+talla
- Cálculo automático Z-scores y percentiles al guardar
- Selector de estándar (OMS / CDC) en el formulario
- Indicadores visuales de percentil (verde/amarillo/rojo según rangos)
- `<MedicionesHistorial>` tabla con todas las mediciones del paciente
- `<MedicionRow>` con acciones editar/eliminar
- Validación: no permitir 2 mediciones en la misma fecha (warning)

**Sesiones estimadas:** 3-4

### Sub-fase 4 — Hitos del desarrollo

**Componentes UI:**
- `<HitosDesarrolloGrid>` agrupado por dominio (5 secciones)
- `<HitoCard>` con:
  - Checkbox de estado (alcanzado / en_proceso / no_evaluado)
  - Fecha al marcar como alcanzado
  - Color según edad del paciente vs edad esperada del hito
  - Tooltip con descripción y fuente
- Filtros: todos / por dominio / solo pendientes / solo retrasados
- Banner de alerta global si hay hitos retrasados
- `src/lib/pediatria/alertas-hitos.ts`:
  - `detectarRetrasos(paciente_edad_meses, hitos_paciente)` → array de hitos en alarma

**Sesiones estimadas:** 2-3

### Sub-fase 5 — Visualización de curvas de crecimiento

**El componente más técnicamente exigente del módulo.**

**Componentes UI:**
- `<CurvasCrecimiento>` con Recharts
- Renderizado de curvas P3, P5, P10, P25, P50, P75, P90, P95, P97
- Cada curva es una serie de puntos (LMS calculado por edad)
- Puntos discretos del paciente superpuestos como scatter
- Línea conectando puntos del paciente para tendencia
- Selector de variable: peso/edad, talla/edad, PC/edad, IMC/edad, peso/talla
- Selector de estándar: OMS / CDC
- Selector de rango etario: 0-2, 2-5, 5-20 años
- Tooltip al hover en punto del paciente: fecha, valor, percentil exacto

**Consideraciones técnicas:**
- Las curvas LMS no son lineales — necesitan ~120-240 puntos por curva para verse suaves
- Performance: precalcular curvas al cargar componente, no en cada render
- Escala: importante que el eje Y se ajuste al rango de la variable + paciente

**Sesiones estimadas:** 4-5

### Sub-fase 6 — Vista principal e integración

**Página principal: `/expediente/[id]/pediatria/page.tsx`**

Estructura tipo dashboard:

1. **Hero pediátrico**
   - Foto (futuro), nombre, edad exacta (años/meses/días)
   - Edad gestacional al nacer (si está registrada)
   - Sexo, fecha de nacimiento
   - Última medición: fecha + percentiles principales en chips de colores

2. **Card 1: Última medición antropométrica**
   - Tabla compacta con peso, talla, PC, IMC y sus percentiles
   - Botón "+ Nueva medición" prominente

3. **Card 2: Curvas de crecimiento**
   - Gráfica con la variable más relevante por defecto
   - Selectores integrados

4. **Card 3: Hitos del desarrollo**
   - Snapshot resumen: "X de Y alcanzados para edad actual"
   - Banner de alerta si hay retrasos
   - Link a vista completa

5. **Card 4: Calculadoras frecuentes pediátricas**
   - Botones rápidos a Holliday-Segar, APGAR, dosis por peso, Westley, Tal
   - Link a `/calculadoras-clinicas/pediatria`

6. **Card 5: Historial completo de mediciones**
   - Tabla expandible con todas las mediciones

**Integración con dashboard general:**
- En `/expediente/[id]/estado` (dashboard general):
  - Si paciente tiene < 18 años, agregar card "Pediatría" con resumen
  - Click → navega a `/expediente/[id]/pediatria`

**Sesiones estimadas:** 2-3

---

## Resumen de esfuerzo

| Sub-fase | Sesiones | Complejidad |
|---|---|---|
| 1. Infra BD + tipos | 2 | Baja |
| 2. Datasets OMS+CDC | 2-3 | Alta (trabajo de datos) |
| 3. Captura mediciones | 3-4 | Media |
| 4. Hitos desarrollo | 2-3 | Media |
| 5. Curvas crecimiento | 4-5 | Alta (técnica) |
| 6. Vista principal | 2-3 | Media |
| **TOTAL** | **15-20 sesiones** | — |

---

## Dependencias y orden recomendado

**Orden estricto:**
1. Sub-fase 1 (infra) → bloqueante para todo
2. Sub-fase 2 (datasets) → bloqueante para 3 y 5
3. Sub-fase 3 (captura) → bloqueante para 5 y 6
4. Sub-fase 4 (hitos) → independiente, puede ir en paralelo con 3
5. Sub-fase 5 (curvas) → requiere 2 y 3
6. Sub-fase 6 (vista) → requiere 3, 4 y 5 listos

**Camino corto sugerido:**
1 → 2 → 3 → 5 → 4 → 6

(Hitos al final permite ver curvas y mediciones funcionando primero, después agregar la capa de hitos.)

---

## Calculadoras pediátricas asociadas (Fase 6 del CALCULADORAS_ROADMAP.md)

Estas viven en `/calculadoras-clinicas/pediatria/[slug]` y son accesibles independientemente. El módulo `/expediente/[id]/pediatria` las muestra como botones rápidos:

- Holliday-Segar (líquidos de mantenimiento)
- APGAR (recién nacido)
- Silverman-Andersen (dificultad respiratoria neonatal)
- Ballard (estimación edad gestacional)
- Z-Scores antropométricos (auxiliar — el módulo ya los calcula)
- Westley (croup)
- Tal Modificada (bronquiolitis)
- Dosis por peso/BSA
- Centor / McIsaac pediátrico (faringitis)
- PECARN (TAC craneal pediátrico)
- Wells pediátrico (TEP)
- Fried/Young (histórico, ajuste dosis)
- Kocher (artritis séptica vs sinovitis transitoria)

Estas se implementan en su fase correspondiente del CALCULADORAS_ROADMAP, no en este módulo.

---

## Pendientes / decisiones diferidas

| Pendiente | Decidir cuándo |
|---|---|
| Edad gestacional al nacer: ¿campo en `pacientes` o en mediciones? | Sub-fase 1 |
| Foto del paciente en hero | V2 |
| Recordatorios de próxima medición esperada | V2 |
| Comparación con hermanos / población local | V3 |
| Exportar reporte pediátrico a PDF | Después de V1 |
| Integración con cartilla de vacunación | V2 (sistema separado) |
| Alertas automáticas vía notificación si hay retraso significativo | V2 |

---

## Riesgos identificados

1. **Datasets oficiales son densos.** WHO publica ~30 archivos Excel con miles de filas cada uno. CDC similar. Procesar todos a JSON usable es trabajo manual + scripts.

2. **Variabilidad clínica de hitos.** El catálogo CDC es referencia, pero la edad de adquisición tiene variabilidad significativa. La lógica de "alarma" debe ser conservadora (no asustar familias) pero útil (detectar retrasos reales).

3. **Curvas de crecimiento técnicamente exigentes.** Renderizar 9 curvas LMS suaves + puntos del paciente con escala correcta y performance aceptable requiere atención técnica.

4. **Edad cambia constantemente.** Un paciente que hoy tiene 11 meses 29 días, mañana tiene 12 meses. La lógica debe usar fecha actual para edad y fecha de medición para datos, no confundirlas.

5. **Datos pediátricos son sensibles.** Pesos, tallas, hitos del desarrollo son datos clínicos protegidos. RLS por clínica obligatorio.

---

## Referencias

- [WHO Child Growth Standards](https://www.who.int/tools/child-growth-standards)
- [CDC Growth Charts](https://www.cdc.gov/growthcharts/clinical_charts.htm)
- [CDC Developmental Milestones (2022 update)](https://www.cdc.gov/ncbddd/actearly/milestones/index.html)
- WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards based on length/height, weight and age. Acta Paediatr Suppl. 2006
- Cole TJ. The LMS method for constructing normalized growth standards. Eur J Clin Nutr. 1990
