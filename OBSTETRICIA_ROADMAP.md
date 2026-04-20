# Módulo Obstétrico — Roadmap Técnico

**Propósito:** Sistema de control prenatal completo. Cada paciente femenino puede tener múltiples embarazos registrados (historial obstétrico). Cada embarazo activo desbloquea control trimestral con biometría fetal, percentiles, bienestar fetal y mediciones maternas.

**Rutas:**
- `/expediente/[id]/obstetricia` — Lista de embarazos del paciente (historial)
- `/expediente/[id]/obstetricia/[embarazo_id]` — Control de un embarazo específico

---

## Estado actual

**No iniciado.** Documento creado el 2026-04-20.

---

## Decisiones de producto (FINALES)

| Aspecto | Decisión |
|---|---|
| Modelo de datos | Múltiples embarazos por paciente (entidad propia con ciclo de vida) |
| Embarazos gemelares | Soportar desde V1 (uno o más fetos por embarazo) |
| Alcance | Solo control prenatal (NO intraparto, NO postparto) |
| Validación de género | Bloquear creación de embarazo si `paciente.sexo != 'F'` |
| Estándar biometría fetal | Hadlock (más usado en México) + opción INTERGROWTH-21st |
| Estándar percentiles fetales | Hadlock por defecto, switch manual |
| Cálculo de FPP | Tres métodos paralelos: FUM (Naegele), USG primer trimestre, USG posterior |

---

## Arquitectura

### Entidades

```
paciente (sexo='F')
   └── embarazo
         ├── feto[] (1 o más)
         │     ├── medicion_fetal[] (por consulta)
         │     └── eventos_relevantes[]
         ├── medicion_materna[] (por consulta)
         ├── laboratorios_obstetricos[] (vincula con sistema labs general)
         └── eventos_embarazo[] (sangrados, contracciones, etc.)
```

### Tablas nuevas en Supabase

#### Tabla 1: `embarazos`

```sql
CREATE TABLE embarazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  -- Datos iniciales
  fum DATE,                                    -- Fecha de última menstruación (puede ser null si solo USG)
  fum_confiable BOOLEAN DEFAULT TRUE,          -- Médico marca si confía en FUM
  fpp_naegele DATE,                            -- Calculado: FUM + 280 días
  
  -- Cálculos por USG
  fpp_usg_temprana DATE,                       -- USG primer trimestre (más precisa)
  fpp_usg_temprana_fecha DATE,                 -- Cuándo se hizo el USG
  fpp_usg_temprana_seg INT,                    -- Semanas estimadas en ese USG
  
  fpp_actual DATE,                             -- La que se usa (decisión médica)
  metodo_fpp TEXT,                             -- 'naegele' | 'usg_temprana' | 'usg_posterior'
  
  -- Tipo de embarazo
  tipo TEXT NOT NULL DEFAULT 'unico',          -- 'unico' | 'gemelar' | 'multiple'
  numero_fetos INT NOT NULL DEFAULT 1,
  corionicidad TEXT,                           -- 'monocorial' | 'bicorial' | 'tricorial' (si múltiple)
  
  -- Antecedentes específicos del embarazo
  gestaciones_previas INT DEFAULT 0,           -- G en G_P_A (gestación)
  partos_previos INT DEFAULT 0,                -- P
  abortos_previos INT DEFAULT 0,               -- A
  cesareas_previas INT DEFAULT 0,
  
  -- Estado
  estado TEXT NOT NULL DEFAULT 'activo',       -- 'activo' | 'finalizado' | 'cancelado'
  fecha_finalizacion DATE,                     -- Cuándo terminó
  resultado TEXT,                              -- 'parto' | 'cesarea' | 'aborto' | 'otro' (V2: detalles)
  
  -- Metadatos
  notas_iniciales TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embarazos_paciente ON embarazos(paciente_id, created_at DESC);
CREATE INDEX idx_embarazos_clinica ON embarazos(clinica_id);
CREATE INDEX idx_embarazos_estado ON embarazos(paciente_id, estado);

ALTER TABLE embarazos ENABLE ROW LEVEL SECURITY;
```

#### Tabla 2: `fetos`

```sql
CREATE TABLE fetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embarazo_id UUID NOT NULL REFERENCES embarazos(id) ON DELETE RESTRICT,
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  identificador TEXT NOT NULL,                 -- 'A', 'B', 'C' (según convención multifeto)
  posicion TEXT,                               -- 'cefalico' | 'pelvico' | 'transverso' (V2)
  sexo_estimado TEXT,                          -- 'M' | 'F' | 'no_determinado'
  sexo_confirmado_semana INT,                  -- A partir de qué semana se confirmó
  
  estado TEXT DEFAULT 'activo',                -- 'activo' | 'no_viable'
  fecha_no_viable DATE,                        -- Si dejó de ser viable
  
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (embarazo_id, identificador)
);
```

#### Tabla 3: `mediciones_fetales`

```sql
CREATE TABLE mediciones_fetales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feto_id UUID NOT NULL REFERENCES fetos(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  fecha_medicion DATE NOT NULL,
  semana_gestacion NUMERIC(4,1) NOT NULL,      -- 24.3 = 24 semanas + 3 días
  
  -- Biometría fetal
  dbp_mm NUMERIC(5,1),                         -- Diámetro biparietal
  cc_mm NUMERIC(5,1),                          -- Circunferencia cefálica
  ca_mm NUMERIC(5,1),                          -- Circunferencia abdominal
  lf_mm NUMERIC(5,1),                          -- Longitud femoral
  lh_mm NUMERIC(5,1),                          -- Longitud humeral
  ccn_mm NUMERIC(5,1),                         -- Longitud cráneo-caudal (CRL, primer trimestre)
  tn_mm NUMERIC(4,2),                          -- Translucencia nucal
  
  -- Peso fetal estimado
  pfe_g NUMERIC(6,1),                          -- Peso fetal estimado en gramos
  pfe_metodo TEXT,                             -- 'hadlock_4' | 'hadlock_3' | 'shepard' | 'manual'
  percentil_pfe INT,                           -- 0-100
  
  -- Líquido amniótico
  ila_mm NUMERIC(4,1),                         -- Índice de líquido amniótico
  bolsillo_max_mm NUMERIC(4,1),                -- Bolsillo vertical máximo
  clasificacion_la TEXT,                       -- 'normal' | 'oligohidramnios' | 'polihidramnios'
  
  -- Doppler
  doppler_au_ip NUMERIC(4,2),                  -- Arteria umbilical, índice de pulsatilidad
  doppler_au_ir NUMERIC(4,2),                  -- Arteria umbilical, índice de resistencia
  doppler_acm_ip NUMERIC(4,2),                 -- Arteria cerebral media
  doppler_acm_psv NUMERIC(5,1),                -- Velocidad pico sistólica ACM
  ratio_cerebro_placentario NUMERIC(4,2),      -- ACM_IP / AU_IP
  doppler_dv NUMERIC(4,2),                     -- Ductus venoso
  doppler_au_flujo TEXT,                       -- 'normal' | 'ausente' | 'reverso'
  
  -- Bienestar fetal
  fcf_lpm INT,                                 -- Frecuencia cardíaca fetal
  movimientos_fetales TEXT,                    -- 'normales' | 'disminuidos' | 'ausentes'
  perfil_biofisico INT,                        -- 0-10 (Manning)
  
  -- Placenta
  ubicacion_placenta TEXT,                     -- 'anterior' | 'posterior' | 'fundica' | 'previa'
  grado_placenta INT,                          -- Grannum 0-3
  
  -- Otros
  presentacion TEXT,                           -- 'cefalica' | 'pelvica' | 'transversa' | 'variable'
  
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_med_fetales_feto ON mediciones_fetales(feto_id, fecha_medicion DESC);
CREATE INDEX idx_med_fetales_clinica ON mediciones_fetales(clinica_id);
```

#### Tabla 4: `mediciones_maternas`

```sql
CREATE TABLE mediciones_maternas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embarazo_id UUID NOT NULL REFERENCES embarazos(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  fecha_medicion DATE NOT NULL,
  semana_gestacion NUMERIC(4,1) NOT NULL,
  
  -- Antropometría materna
  peso_kg NUMERIC(5,2),
  ganancia_peso_kg NUMERIC(4,2),               -- Calculado vs peso pregestacional
  
  -- Signos vitales
  ta_sistolica INT,
  ta_diastolica INT,
  fc_lpm INT,
  
  -- Útero
  altura_uterina_cm NUMERIC(4,1),              -- Maniobra de Leopold
  
  -- Síntomas relevantes
  edema TEXT,                                  -- 'no' | 'leve' | 'moderado' | 'severo'
  cefalea BOOLEAN DEFAULT FALSE,
  vision_borrosa BOOLEAN DEFAULT FALSE,
  epigastralgia BOOLEAN DEFAULT FALSE,
  contracciones BOOLEAN DEFAULT FALSE,
  sangrado BOOLEAN DEFAULT FALSE,
  perdida_liquido BOOLEAN DEFAULT FALSE,
  
  -- Estudios complementarios
  proteinuria TEXT,                            -- 'negativo' | '+' | '++' | '+++' | '++++'
  glucosa_capilar INT,                         -- mg/dL si toma
  
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_med_maternas_embarazo ON mediciones_maternas(embarazo_id, fecha_medicion DESC);
```

#### Tabla 5: `eventos_embarazo`

```sql
CREATE TABLE eventos_embarazo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embarazo_id UUID NOT NULL REFERENCES embarazos(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES profiles(id),
  clinica_id UUID NOT NULL REFERENCES clinicas(id),
  
  fecha DATE NOT NULL,
  semana_gestacion NUMERIC(4,1),
  tipo TEXT NOT NULL,                          -- 'sangrado' | 'amenaza_aborto' | 'amenaza_parto_pretermino' | 'preeclampsia' | 'diabetes_gestacional' | 'rpm' | 'otro'
  severidad TEXT,                              -- 'leve' | 'moderado' | 'severo'
  descripcion TEXT NOT NULL,
  manejo TEXT,
  resuelto BOOLEAN DEFAULT FALSE,
  fecha_resolucion DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Estructura de archivos

```
src/app/(app)/expediente/[id]/obstetricia/
├── page.tsx                                  # Lista de embarazos
├── nuevo/page.tsx                            # Crear nuevo embarazo
└── [embarazo_id]/
    └── page.tsx                              # Control de embarazo activo

src/components/obstetricia/
├── ObstetriciaHero.tsx                       # Header con resumen del embarazo activo
├── ListaEmbarazos.tsx                        # Historial obstétrico
├── EmbarazoCard.tsx                          # Card individual de embarazo
├── NuevoEmbarazoForm.tsx                     # Formulario de creación
├── ResumenEmbarazo.tsx                       # FPP, semanas actuales, próxima cita
├── BiometriaFetalForm.tsx                    # Captura de biometría
├── BiometriaFetalHistorial.tsx               # Tabla de mediciones fetales
├── MedicionMaternaForm.tsx                   # Captura materna
├── MedicionMaternaHistorial.tsx              # Tabla de mediciones maternas
├── DopplerSection.tsx                        # Sub-componente para Doppler
├── BienestarFetalSection.tsx                 # Manning, FCF, MF
├── EventosEmbarazoTimeline.tsx               # Línea de tiempo de eventos
├── EventoEmbarazoForm.tsx                    # Capturar evento clínico
├── CurvasFetalesGrafica.tsx                  # Gráficas de percentiles fetales
├── CurvaPesoEstimado.tsx                     # Específica para PFE
├── SelectorFeto.tsx                          # Si gemelar, switch entre fetos
├── CalculadoraSemanasGestacion.tsx           # Calcula semanas a fecha
├── TrimestreNavigator.tsx                    # Switch entre T1, T2, T3
└── CardCalculadorasObstetricas.tsx           # Quick access

src/lib/obstetricia/
├── types.ts                                  # Tipos TypeScript
├── fpp-calculations.ts                       # Naegele, USG, etc.
├── semanas-gestacion.ts                      # Cálculo de SG actual
├── pfe-formulas.ts                           # Hadlock 4, Shepard, etc.
├── percentiles-fetales.ts                    # Cálculo de percentiles
├── trimestres.ts                             # Lógica T1/T2/T3
├── alertas-clinicas.ts                       # Detección de patología
└── datasets/
    ├── hadlock_pfe_percentiles.json          # Tablas de percentiles
    ├── intergrowth_pfe_percentiles.json
    ├── biometria_dbp_percentiles.json        # Por semana
    ├── biometria_cc_percentiles.json
    ├── biometria_ca_percentiles.json
    ├── biometria_lf_percentiles.json
    ├── doppler_au_ip_percentiles.json
    └── doppler_acm_ip_percentiles.json

supabase/migrations/                          (raíz del repo)
├── supabase_migration_obstetricia_embarazos.sql
├── supabase_migration_obstetricia_fetos.sql
├── supabase_migration_obstetricia_mediciones_fetales.sql
├── supabase_migration_obstetricia_mediciones_maternas.sql
└── supabase_migration_obstetricia_eventos.sql
```

---

## Cálculos clínicos clave

### 1. FPP por Naegele

```
FPP = FUM + 7 días - 3 meses + 1 año
```

### 2. FPP por USG

Más precisa según el momento:
- **CRL en primer trimestre (6-13 semanas):** ±5 días de precisión
- **DBP/CC en segundo trimestre (14-20 semanas):** ±7-10 días
- **Después de 20 semanas:** menos precisa, no se recomienda recalcular

### 3. Semanas de gestación actuales

```
SG = (fecha_actual - FUM) / 7
```

Con la FPP definitiva (la que el médico eligió como confiable).

### 4. Peso fetal estimado — Hadlock 4

```
log10(PFE) = 1.3596 + (0.0064 × CC) + (0.0424 × CA) + (0.174 × LF) 
           + (0.00061 × DBP × CA) − (0.00386 × CA × LF)
```

Donde:
- CC, CA, LF en cm
- PFE en gramos

### 5. Ratio cerebro-placentario

```
RCP = ACM_IP / AU_IP
```

Si RCP < percentil 5 → redistribución circulatoria fetal (signo de hipoxia).

### 6. Detección de alarmas automáticas

- TA ≥ 140/90 + proteinuria → alerta preeclampsia
- Glucosa capilar ≥ 92 en ayunas → alerta diabetes gestacional
- Doppler AU con flujo ausente o reverso → alerta crítica
- ILA <5 cm → oligohidramnios
- ILA >25 cm → polihidramnios
- PFE <p10 con doppler alterado → restricción de crecimiento

---

## Vista principal del módulo

### Hero del embarazo activo

- Nombre paciente, edad
- **Semanas de gestación actuales** (grande, prominente): "32+4"
- **FPP**: "15 de junio 2026"
- Tipo: "Embarazo único" / "Gemelar bicorial biamniótico"
- Próxima cita esperada (calculada según trimestre)
- Indicadores en chips: TA, peso ganado, alertas activas

### Cards principales

1. **Resumen del embarazo**
   - Datos clave: FUM, FPP por método, paridad (G_P_A)
   - Botón "Cambiar FPP definitiva"

2. **Última consulta materna**
   - Fecha, peso, TA, AU, síntomas
   - Botón "+ Nueva consulta materna"

3. **Última consulta fetal**
   - Por feto (selector si gemelar)
   - Biometría, PFE, percentil, ILA, Doppler
   - Botón "+ Nueva medición fetal"

4. **Curvas de crecimiento fetal**
   - Gráficas de percentiles (PFE por semana)
   - Selector de variable: PFE, DBP, CC, CA, LF
   - Selector de feto si gemelar

5. **Bienestar fetal**
   - FCF, perfil biofísico, movimientos
   - Estado actual

6. **Eventos del embarazo**
   - Timeline cronológica
   - Sangrados, contracciones, hospitalizaciones, etc.
   - Botón "+ Nuevo evento"

7. **Calculadoras obstétricas frecuentes**
   - Quick access: Bishop, Manning, Hadlock manual, FL/AC, RMI
   - Link a `/calculadoras-clinicas/obstetricia-ginecologia`

8. **Laboratorios obstétricos**
   - Filtro pre-aplicado a labs específicos del embarazo
   - Triple marcador, curva tolerancia glucosa, urocultivos, etc.

---

## Sub-fases de implementación

### Sub-fase 1 — Infraestructura BD + tipos + cálculos núcleo

**Entregables:**
- 5 migraciones SQL (embarazos, fetos, mediciones_fetales, mediciones_maternas, eventos)
- `src/lib/obstetricia/types.ts`
- `src/lib/obstetricia/fpp-calculations.ts` (Naegele + USG)
- `src/lib/obstetricia/semanas-gestacion.ts`
- `src/lib/obstetricia/trimestres.ts`
- Sin UI

**Sesiones:** 2

### Sub-fase 2 — Datasets de percentiles fetales

**Trabajo de datos:**
- Datasets Hadlock (percentiles por semana de PFE, DBP, CC, CA, LF)
- Datasets INTERGROWTH-21st (alternativa)
- Datasets Doppler AU IP/IR por semana
- Datasets Doppler ACM IP/PSV por semana

**Código:**
- `src/lib/obstetricia/percentiles-fetales.ts`
- `src/lib/obstetricia/pfe-formulas.ts` (Hadlock 4 implementado)

**Sesiones:** 2-3

### Sub-fase 3 — Crear embarazo + lista de embarazos

**Entregables:**
- Página `/obstetricia` con lista de embarazos del paciente
- Página `/obstetricia/nuevo` con formulario de creación
- Validación: solo permitir si `paciente.sexo === 'F'`
- Cálculo automático de FPP por Naegele al ingresar FUM
- Si tipo = gemelar/múltiple: crear N fetos automáticamente
- ResumenEmbarazo.tsx con datos clave

**Sesiones:** 2-3

### Sub-fase 4 — Captura de mediciones (materna y fetal)

**Entregables:**
- `BiometriaFetalForm` con todos los campos (DBP, CC, CA, LF, ILA, Doppler, FCF, etc.)
- Cálculo automático de PFE al guardar (Hadlock 4)
- Cálculo automático de percentiles
- Cálculo automático de ratio cerebro-placentario
- `MedicionMaternaForm` con peso, TA, AU, síntomas, proteinuria
- Cálculo de ganancia de peso
- Detección automática de alertas (TA alta, proteinuria, etc.)
- Historiales en tabla
- Selector de feto si gemelar

**Sesiones:** 4-5

### Sub-fase 5 — Eventos clínicos del embarazo

**Entregables:**
- `EventoEmbarazoForm` para capturar eventos
- `EventosEmbarazoTimeline` cronológico
- Filtros por tipo y severidad
- Marcado de resolución

**Sesiones:** 2

### Sub-fase 6 — Curvas fetales y visualización

**Entregables:**
- `CurvasFetalesGrafica` con percentiles fetales (P3, P10, P50, P90, P97)
- Renderizado de PFE por semana de gestación
- Renderizado de biometría individual (DBP, CC, CA, LF)
- Switch de estándar (Hadlock / INTERGROWTH-21st)
- Si gemelar: renderizado simultáneo de ambos fetos en la misma gráfica
- Tooltip con valor y percentil exacto

**Sesiones:** 3-4

### Sub-fase 7 — Vista principal del embarazo activo

**Entregables:**
- Página `/obstetricia/[embarazo_id]` con dashboard completo
- Hero con SG actuales, FPP, alertas
- Las 8 cards integradas
- Selector de feto activo (si gemelar)
- Navegador de trimestre (T1, T2, T3)

**Sesiones:** 3-4

### Sub-fase 8 — Integración y alertas

**Entregables:**
- Card "Embarazo activo" en dashboard general `/expediente/[id]/estado` (visible si `paciente.sexo === 'F'` y embarazo activo)
- Sistema de alertas clínicas (`alertas-clinicas.ts`)
- Notificaciones visuales en hero
- Link directo a calculadoras obstétricas relevantes

**Sesiones:** 2

---

## Resumen de esfuerzo

| Sub-fase | Sesiones | Complejidad |
|---|---|---|
| 1. Infra BD + cálculos | 2 | Media |
| 2. Datasets fetales | 2-3 | Alta (datos) |
| 3. Crear embarazo | 2-3 | Media |
| 4. Captura mediciones | 4-5 | Alta |
| 5. Eventos | 2 | Baja |
| 6. Curvas fetales | 3-4 | Alta (técnica) |
| 7. Vista principal | 3-4 | Media |
| 8. Integración | 2 | Baja |
| **TOTAL** | **20-25 sesiones** | — |

---

## Calculadoras obstétricas asociadas (Fase 7 del CALCULADORAS_ROADMAP)

Viven en `/calculadoras-clinicas/obstetricia-ginecologia/[slug]`. El módulo las muestra como quick access:

- Naegele (FPP)
- Bishop (probabilidad de éxito de inducción)
- Manning / Perfil Biofísico
- Hadlock (PFE manual)
- Relación FL/AC (RCIU)
- Apgar neonatal
- Ferriman-Gallwey (hirsutismo, no aplica directo a embarazo)
- RMI (masas anexiales)
- Spike (fiebre intraparto - no en V1)
- Quigley (no en V1)

---

## Casos de uso clínicos cubiertos en V1

✅ Crear embarazo en paciente femenino
✅ Calcular FPP por Naegele y/o USG
✅ Recalcular FPP cuando llega un USG nuevo
✅ Captura de consulta prenatal completa (materna + fetal)
✅ Cálculo automático de PFE con Hadlock 4
✅ Percentiles fetales por semana de gestación
✅ Detección de RCIU (PFE <p10)
✅ Detección de alteraciones Doppler
✅ Detección de preeclampsia (TA + proteinuria)
✅ Soporte gemelar con seguimiento independiente por feto
✅ Timeline de eventos clínicos del embarazo
✅ Historial obstétrico completo (G_P_A)
✅ Visualización de curvas de crecimiento fetal

## NO cubre V1

❌ Intraparto (partograma, monitoreo electrónico fetal)
❌ Postparto (puerperio, lactancia)
❌ Cartilla materno-perinatal oficial mexicana (formato exacto)
❌ Triple/cuádruple marcador (cálculo de riesgo cromosómico)
❌ Generación de carnet perinatal en PDF

---

## Pendientes / decisiones diferidas

| Pendiente | Cuándo decidir |
|---|---|
| Edad gestacional de viabilidad (24 vs 22) | Sub-fase 1 |
| Política de "embarazo finalizado": ¿editable o solo lectura? | Sub-fase 3 |
| Carnet perinatal en PDF | V2 |
| Integración con solicitud de USG estructurado | V2 |
| Recordatorios de próxima consulta (push notification) | V2 |
| Gemelar discordante: comparación visual entre fetos | V2 |

---

## Riesgos identificados

1. **Complejidad clínica.** Obstetricia es de las especialidades con más variables interrelacionadas. El schema es grande porque la realidad clínica lo es. No se puede simplificar sin perder utilidad.

2. **Datasets fetales son menos accesibles que pediátricos.** Hadlock e INTERGROWTH-21st publican tablas pero no en formato JSON listo. Trabajo manual de extracción.

3. **Gemelar duplica complejidad de UI.** Toda la vista necesita selector de feto. La gráfica debe poder mostrar ambos. Decisiones de UX no triviales.

4. **Cálculo de SG actual depende de fecha del cliente.** Si el reloj del usuario está mal, las SG mostradas serán incorrectas. Mitigar usando fecha del servidor.

5. **Alertas clínicas son responsabilidad alta.** Una alerta falsamente negativa (no detectar preeclampsia) tiene consecuencias clínicas reales. Validar bien las reglas y mantenerlas conservadoras.

---

## Referencias

- Hadlock FP et al. Estimation of fetal weight with the use of head, body, and femur measurements. Am J Obstet Gynecol. 1985
- INTERGROWTH-21st Consortium. International standards for fetal growth based on serial ultrasound measurements. Lancet. 2014
- Salomon LJ et al. ISUOG Practice Guidelines: ultrasound assessment of fetal biometry and growth. Ultrasound Obstet Gynecol. 2019
- ACOG Practice Bulletin No. 234: Prediction and Prevention of Spontaneous Preterm Birth. 2021
- Norma Oficial Mexicana NOM-007-SSA2-2016 (atención del embarazo)
