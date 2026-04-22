# LABS_REDISEÑO_PLAN.md

> Plan de ejecución del rediseño completo del sistema de laboratorios de Spinus.
> Cada sub-fase es atómica: scope acotado, archivos permitidos/prohibidos explícitos, criterios de cierre, commit message sugerido.
> El usuario (Angel) ejecuta SQL manualmente y commits manualmente. Claude Code propone, no aplica DDL ni hace commits.

---

## 0. Resumen de decisiones tomadas

| # | Decisión | Valor |
|---|---|---|
| Feature 1 | Documentos PDF adjuntos | Reutiliza modal global de Documentos del expediente |
| Feature 2 | Mediciones longitudinales | Página nueva con dropdown selector + gráfica + tabla |
| Catálogo | Tamaño | A.3 — extenso (~150 analitos) |
| Catálogo | Custom | 2.B — permitir analito custom inline |
| Catálogo | Unidades | B.1 — una unidad fija por analito (convención mexicana) |
| Catálogo | Rangos | C.2 — universales + sobreescritura por sexo donde aplique |
| Catálogo | Seed | Claude propone borrador, Angel revisa clínicamente en una pasada |
| Mediciones | Granularidad temporal | D.2 — `timestamptz`, múltiples mediciones por día |
| Mediciones | FK `creado_por` | `profiles(id) ON DELETE RESTRICT` (estándar del repo) |
| Mediciones | Eliminación | Hard delete con audit log (NOM-004 protege notas firmadas, no datos de seguimiento) |
| Antropometría | Captura | E.2 — dentro del mismo sistema unificado |
| Antropometría | Conflicto con `pacientes.peso_kg/talla_cm/imc` | α — convivencia con sincronización por trigger |
| Export PDF | Cuándo | F.2 — phase 2 (`html2pdf.js` ya en bundle) |
| Migración legacy | Orden | G.3 — TabGraficas muere ya, useLaboratoriosNormalizados muere al final |
| Entrada al módulo | Dónde vive | Opción A — 6ª card "Laboratorios" en `ExpedienteCardsGrid` |
| Hero stats | Cantidad | **2 KPIs**: Analitos rastreados + Última medición |
| Documentos en /labs | Tipos nuevos en CHECK | `'resultado_laboratorio'`, `'estudio_imagen'` |
| Librería gráficas | Cuál | **Recharts ^3.8.1** (confirmado en `package.json`) |
| Audit log | Patrón | **Tabla `audit_log` existente + función `log_tabla_change()` genérica** — solo aplicar trigger |

---

## 0.1. Stack confirmado del repo (relevante para implementación)

Verificado en `package.json` v0.1.0:

- **Next.js 16.2.1** con `--webpack` (no Turbopack). React 19.2.4
- **Recharts ^3.8.1** → librería de gráficas
- **SWR ^2.4.1** → todos los hooks de fetch usan SWR (no react-query)
- **lucide-react ^1.6.0** → iconos del proyecto
- **react-dropzone ^15.0.0** → upload de PDFs
- **@react-pdf/renderer ^4.4.0** + **html2pdf.js ^0.14.0** → generación de PDFs
- **@supabase/ssr ^0.9.0** + **@supabase/supabase-js ^2.100.0** → DB
- **@anthropic-ai/sdk ^0.80.0** + **@google/generative-ai ^0.24.1** → IAs (con anonimización previa, NO negociable)
- **@cornerstonejs/* ^4.20.0** → DICOM viewer
- **vitest ^4.1.2** → tests



---

## 1. Mapa de sub-fases

| # | Nombre | Tipo | Tamaño | Bloquea | Depende | Estado |
|---|---|---|---|---|---|---|
| 0 | Cleanup y deuda técnica documentada | chore | XS | — | — | ✅ Cerrada 2026-04-21 |
| 1A | Schema SQL: tablas + RLS + trigger | infra | M | 1B, 2 | 0 | ⏳ Pendiente |
| 1B | Seed del catálogo de analitos (~150) | data clínica | L | 3 | 1A | — |
| 2 | Página base + Hero + secciones vacías | UI | M | 3, 4, 6 | 1A | — |
| 3 | Modal "Agregar medición" + autocomplete + custom | UI | M | 4, 5 | 1B, 2 | — |
| 4 | Dropdown selector + detail header + tabla | UI | M | 5 | 3 | — |
| 5 | Gráfica con bandas + tendencia + leyenda | UI | M | — | 4 | — |
| 6 | Integración Documentos (extender CHECK + filtrar en /labs) | UI + SQL | S | — | 2 | — |
| 7 | Card "Laboratorios" en `ExpedienteCardsGrid` | UI | XS | — | 2 | — |
| 8 | Migración /estado + exportador + drop tabla legacy | refactor + SQL | L | 9 | 4, 5 | — |
| 9 | QA end-to-end + validaciones manuales | QA | M | — | todas | — |

**Camino crítico**: 0 → 1A → 1B → 2 → 3 → 4 → 5 → 8 → 9.
**Paralelizable**: 6 y 7 pueden hacerse después de 2 sin bloquear el camino crítico.

Total estimado: **9-12 sesiones de Claude Code** (varía según fluidez de cada sesión y número de iteraciones).

---

## 2. Sub-fases — detalle completo

### SUB-FASE 0 — Cleanup y deuda técnica documentada

**Objetivo**: Cerrar la deuda técnica registrada en CLAUDE.md sobre TabGraficas, eliminar lo huérfano, documentar lo que sigue vivo y por qué.

**Scope atómico**:
- Eliminar `src/components/TabGraficas.tsx` (utilitario huérfano post-Fase 7)
- Mover `normalizarKey` y `ParamGrafica` a `src/hooks/useLaboratoriosNormalizados.ts` (que sigue vivo hasta sub-fase 8)
- **CRÍTICO — Auditar consumidores reales** de `useLaboratoriosNormalizados`:
  - Ejecutar `grep -rn "useLaboratoriosNormalizados" src/` y reportar TODOS los matches
  - Si solo `/expediente/[id]/estado` lo consume → plan de sub-fase 8 procede tal como está
  - Si hay MÁS consumidores (ej. PDFs, exports, otra ruta) → reportar antes de seguir, ajustar sub-fase 8 antes de arrancarla
  - Documentar lista en `LABS_REDISEÑO_NOTES.md`
- Inspeccionar `/expediente/[id]/laboratorios/page.tsx` y subrutas existentes — listar archivos a eliminar en sub-fase 8
- Crear `LABS_REDISEÑO_NOTES.md` en raíz del repo con inventario de cosas a borrar al final
- Actualizar CLAUDE.md cerrando el item de TabGraficas y abriendo dos nuevos: "useLaboratoriosNormalizados — borrar al final del rediseño de labs", "Tabla `laboratorios` legacy — drop al final del rediseño"

**Archivos PERMITIDOS para tocar**:
- `src/components/TabGraficas.tsx` (eliminar)
- `src/hooks/useLaboratoriosNormalizados.ts` (recibe los exports movidos)
- `CLAUDE.md` (actualizar)
- `LABS_REDISEÑO_NOTES.md` (crear)

**Archivos PROHIBIDOS**:
- Cualquier otro archivo en `src/`
- Cualquier `supabase_migration_*.sql`
- `package.json` (no instalar dependencias en esta sub-fase)

**Criterios de cierre**:
- `npm run build` verde
- `grep -r "TabGraficas" src/` retorna 0 resultados
- `grep -r "useLaboratoriosNormalizados" src/` retorna solo los consumidores documentados
- LABS_REDISEÑO_NOTES.md existe y lista exactamente qué se eliminará y cuándo
- Validación visual: el dashboard `/estado` sigue funcionando exactamente igual (sin regresiones)

**Commit sugerido**: `chore(labs): eliminar TabGraficas, mover utilidades a hook y documentar deuda técnica`

**Riesgos**:
- Si `useLaboratoriosNormalizados` tiene MÁS consumidores de los esperados, surfacearlo en el reporte de cierre (no resolverlo en esta sub-fase).

---

### SUB-FASE 1A — Schema SQL: tablas + RLS + trigger

**Objetivo**: Generar archivos `.sql` con el schema base del nuevo sistema. Angel los ejecuta manualmente en Supabase.

**Scope atómico**:
- Crear `supabase_migration_labs_catalogo.sql`: tabla `analitos_catalogo` con columnas:
  - `id uuid PK`
  - `clave text UNIQUE NOT NULL` (slug, ej. `'hba1c'`, `'glucosa_ayuno'`)
  - `nombre text NOT NULL` (display)
  - `nombres_alternativos text[]` (sinónimos para búsqueda — ej. `['glucemia', 'glicemia']`)
  - `categoria text NOT NULL CHECK (categoria IN (...))` (`'antropometria'`, `'signos_vitales'`, `'hematologia'`, `'quimica'`, `'hueso'`, `'endocrino'`, `'inmunologia'`)
  - `unidad text NOT NULL`
  - `bands_type text NOT NULL CHECK (bands_type IN ('high-bad','low-bad','low-and-high-bad','none'))`
  - `rango_default jsonb` (estructura: `{ok_min, ok_max, warn_min?, warn_max?}`)
  - `rango_femenino jsonb` (opcional, sobreescritura)
  - `rango_masculino jsonb` (opcional, sobreescritura)
  - `precision_decimales int DEFAULT 1`
  - `activo boolean DEFAULT true`
  - `created_at timestamptz DEFAULT now()`
- Crear `supabase_migration_labs_mediciones.sql`: tabla `mediciones_analitos` con columnas:
  - `id uuid PK`
  - `paciente_id uuid REFERENCES pacientes(id) ON DELETE RESTRICT NOT NULL`
  - `analito_id uuid REFERENCES analitos_catalogo(id) ON DELETE RESTRICT` (NULL si custom)
  - `nombre_custom text` (NULL si NO custom)
  - `unidad_custom text` (NULL si NO custom)
  - `categoria_custom text` (NULL si NO custom)
  - `valor numeric NOT NULL`
  - `medido_en timestamptz NOT NULL` (fecha + hora — D.2)
  - `notas text`
  - `creado_por uuid REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL` (estándar del repo, ya validado en calculadoras Fase 1)
  - `created_at timestamptz DEFAULT now()`
  - CHECK: `(analito_id IS NOT NULL AND nombre_custom IS NULL) OR (analito_id IS NULL AND nombre_custom IS NOT NULL AND unidad_custom IS NOT NULL)`
- Crear `supabase_migration_labs_documentos_tipos.sql`: extender CHECK constraint de `documentos.tipo` con `'resultado_laboratorio'` y `'estudio_imagen'` (DROP + ADD pattern como migraciones previas)
- Crear `supabase_migration_labs_trigger_antropometria.sql`: trigger que actualiza `pacientes.peso_kg/talla_cm/imc` cuando se inserta una medición de antropometría correspondiente (peso/talla; calcular imc si ambos disponibles)
- **Aplicar trigger de audit existente** (NO crear tabla nueva): el repo ya tiene `audit_log` + función `log_tabla_change()` genérica. Solo agregar al final de la migración de mediciones:
  ```sql
  create trigger audit_mediciones_analitos
    after insert or update or delete on mediciones_analitos
    for each row execute function log_tabla_change();
  ```
  `analitos_catalogo` NO necesita audit (es referencia clínica genérica, no PII).
- RLS en `analitos_catalogo`: SELECT abierto a `authenticated`, INSERT/UPDATE/DELETE solo a service role (catálogo es read-only para médicos)
- RLS en `mediciones_analitos`: heredar filtro de clínica vía paciente (mismo patrón que `consultas`/`laboratorios`)
- Índices: `idx_mediciones_paciente`, `idx_mediciones_paciente_analito`, `idx_mediciones_paciente_medido_en`
- Generar tipos TS: `npm run gen-types` o `supabase gen types typescript --project-id ... > src/types/database.types.ts` (verificar comando real del repo en CLAUDE.md o package.json)
- Agregar interfaces a `src/types/index.ts`: `AnalitoCatalogo`, `MedicionAnalito`, `RangoAnalito`, etc.

**Archivos PERMITIDOS**:
- `supabase_migration_labs_catalogo.sql` (crear)
- `supabase_migration_labs_mediciones.sql` (crear)
- `supabase_migration_labs_documentos_tipos.sql` (crear)
- `supabase_migration_labs_trigger_antropometria.sql` (crear)
- `src/types/index.ts` (agregar interfaces)
- `src/types/database.types.ts` (regenerar — solo si Claude Code puede correr el comando, si no se queda como TODO para Angel)

**Archivos PROHIBIDOS**:
- Cualquier otro archivo en `src/`
- Cualquier migración SQL existente (no modificar)
- Cualquier componente UI

**Criterios de cierre**:
- 4 archivos `.sql` creados, sintaxis revisada por Angel antes de ejecutar
- Angel ejecuta los 4 SQLs en Supabase manualmente, en orden: catálogo → mediciones → documentos_tipos → trigger
- Tipos TS regenerados (manual si es necesario)
- `npm run build` verde después de regenerar tipos
- `LABS_REDISEÑO_NOTES.md` actualizado con nombres de tablas creadas y constraints relevantes

**Commit sugerido**: `feat(labs): schema base — analitos_catalogo + mediciones + extensión documentos`

**Riesgos**:
- Si la regeneración de tipos rompe builds en otros lados (poco probable porque solo se agregan tipos), surfacearlo y resolver inline.
- El trigger de sincronización debe respetar la inmutabilidad de notas clínicas — verificar que NO toca columnas de consulta inmutables.
- Verificar que `profiles(id)` existe y es la FK correcta (vs `auth.users(id)`).

---

### SUB-FASE 1B — Seed del catálogo de analitos

**Objetivo**: Poblar `analitos_catalogo` con ~150 analitos clínicamente relevantes para Mexico, con rangos y unidades convencionales mexicanas.

**Modalidad**: Claude Code propone el SQL completo basado en paneles estándar mexicanos. Angel revisa clínicamente en una sola pasada al final y corrige donde haga falta. NO se itera analito por analito.

**Scope atómico**:
- Crear `supabase_migration_labs_seed_catalogo.sql` con INSERTs para todos los analitos
- Cobertura por panel estándar (objetivo total: 130-200 analitos):
  - **Antropometría** (3-5): peso, talla, imc, perímetro abdominal
  - **Signos vitales** (5-7): TAS, TAD, FC, SpO2, temperatura, frecuencia respiratoria
  - **Biometría hemática completa** (~20): Hb, Hto, eritrocitos, VCM, HCM, CHCM, RDW, leucocitos totales, neutrófilos abs/%, linfocitos abs/%, monocitos abs/%, eosinófilos abs/%, basófilos abs/%, plaquetas, VPM
  - **Química sanguínea básica** (~15): glucosa ayuno, urea, BUN, creatinina, ácido úrico, electrolitos (Na, K, Cl, Ca, Mg, P)
  - **Perfil lipídico** (~5): CT, HDL, LDL, VLDL, TG, índice CT/HDL
  - **Función renal** (~5): TFG estimada, microalbuminuria, relación albúmina/creatinina urinaria
  - **Función hepática** (~10): AST, ALT, ALP, GGT, BT, BD, BI, albúmina, proteínas totales, globulinas
  - **Perfil tiroideo** (~5): TSH, T3, T4, T3 libre, T4 libre, anti-TPO, anti-TG
  - **Marcadores inflamatorios** (~5): VSG, PCR, PCR ultrasensible, ferritina, procalcitonina
  - **Glucosa y diabetes** (~5): HbA1c, glucosa postprandial, insulina basal, HOMA-IR, péptido C
  - **Coagulación** (~5): TP, TPT, INR, fibrinógeno, dímero D
  - **Hormonal básico** (~10): cortisol AM, cortisol PM, ACTH, prolactina, LH, FSH, estradiol, testosterona total, testosterona libre, SHBG, DHEA-S, progesterona
  - **Marcadores cardíacos** (~5): troponina I/T, CK total, CK-MB, BNP, NT-proBNP
  - **Marcadores tumorales comunes** (~10): PSA total, PSA libre, CA 125, CA 19-9, CA 15-3, CEA, AFP, beta-HCG cuantitativa
  - **Vitaminas y minerales** (~10): vitamina D 25-OH, vitamina B12, ácido fólico, hierro sérico, transferrina, TIBC, % saturación, magnesio, zinc, selenio
  - **Específicos ortopedia/reumatología** (~15): factor reumatoide, anti-CCP, ANA, anti-DNA, complemento C3/C4, calcio iónico, PTH, fosfatasa alcalina ósea, beta-CTX, P1NP, osteocalcina, HLA-B27
  - **Otros relevantes** (~25): perfil ginecológico, marcadores virales (HBsAg, anti-HCV, VIH), ácido láctico, amonio, lipasa, amilasa, IgG/IgA/IgM/IgE total, homocisteína
- Para cada analito incluir:
  - `clave` snake_case única
  - `nombre` y `nombres_alternativos` (sinónimos comunes en MX, ej. "glicemia", "TGO"/"TGP")
  - `categoria` correcta
  - `unidad` convencional MX (mg/dL para glucosa, no mmol/L)
  - `bands_type`: high-bad / low-bad / low-and-high-bad / none
  - `rango_default` con bandas correctas
  - `rango_femenino` / `rango_masculino` donde aplique (Hb, Hto, eritrocitos, ferritina, hierro, creatinina, ácido úrico, hormonas reproductivas, PSA)
  - `precision_decimales` (HbA1c=1, glucosa=0, creatinina=2, etc.)
- Comentarios SQL en bloques por panel para que Angel pueda revisar por sección

**Archivos PERMITIDOS**:
- `supabase_migration_labs_seed_catalogo.sql` (crear)

**Archivos PROHIBIDOS**:
- Todo lo demás

**Criterios de cierre**:
- Borrador SQL completo con ~150 analitos, sintaxis válida
- **REVISIÓN MÉDICA OBLIGATORIA POR ANGEL** antes de ejecutar — Claude Code no puede validar corrección clínica de rangos. Angel revisa en una pasada, marca correcciones, Claude Code aplica las correcciones.
- Angel ejecuta el SQL manualmente
- Query `SELECT count(*) FROM analitos_catalogo;` retorna ≥130 y conteos por categoría coherentes
- Documentar en LABS_REDISEÑO_NOTES.md: total de analitos seeded, fecha de última revisión clínica

**Commit sugerido**: `feat(labs): seed inicial del catálogo de analitos (~150 entries)`

**Riesgos**:
- Rangos clínicos incorrectos = pérdida de confianza del usuario médico. Angel DEBE revisar antes de ejecutar.
- Sinónimos faltantes degradan la búsqueda. Si el médico busca "glicemia" y solo está como "glucosa", no la encuentra. Generosos en `nombres_alternativos` (incluir terminología popular MX, abreviaturas, en inglés cuando aplique).
- Algunas unidades varían entre laboratorios mexicanos (ej. ferritina a veces en ng/mL, a veces en µg/L — son equivalentes pero la nomenclatura difiere). Adoptar la más común en MX y mencionar la alterna en `nombres_alternativos` o nota.

---

### SUB-FASE 2 — Página base + Hero + secciones vacías

**Objetivo**: Crear la ruta `/expediente/[id]/laboratorios` nueva con shell completo (Hero rico + 2 secciones vacías), sin lógica de captura ni gráficas todavía.

**Scope atómico**:
- Crear `src/app/(app)/expediente/[id]/laboratorios/page.tsx` (Server Component)
  - Fetch del paciente (mismo patrón que otras rutas del expediente)
  - Fetch de stats agregados: count de analitos rastreados + fecha de última medición
  - Render del HeroExpediente reusable (eyebrow "Mediciones & documentos", nombre, meta, acciones, stats row con **2 KPIs**)
  - Sección "Documentos clínicos" con header + botón "Subir documento" + strip vacío con mensaje "Sin documentos clínicos. Sube resultados de laboratorio o estudios de imagen."
  - Sección "Mediciones longitudinales" con header + botón "Agregar medición" + card vacío con mensaje "Sin mediciones registradas. Agrega tu primer dato para comenzar el seguimiento."
- Crear hook `useStatsLabs(pacienteId)` con SWR (patrón del repo)
- NO modales todavía — los botones renderean pero no hacen nada (placeholders)
- NO dropdown ni gráfica todavía
- Iconos desde `lucide-react` (ya en bundle)
- Estructura responsiva mobile-first siguiendo iOS-strict (ya validada en mockup)

**KPIs del Hero (DEFINITIVO, 2 stats)**:
- **Analitos rastreados** (count de analitos distintos con al menos 1 medición)
- **Última medición** (fecha del `medido_en` más reciente de cualquier analito)

Si después del rollout se siente que falta uno, agregar "Mediciones totales" (count global de data points históricos). NO agregar HbA1c hardcodeado (bias específico de diabetes) ni "Último analito capturado" (información sin valor clínico).

**Archivos PERMITIDOS**:
- `src/app/(app)/expediente/[id]/laboratorios/page.tsx` (crear)
- `src/components/labs/HeroLabs.tsx` (crear, o reusar HeroExpediente con prop variant)
- `src/components/labs/SeccionDocumentosLabs.tsx` (crear vacío)
- `src/components/labs/SeccionMedicionesLabs.tsx` (crear vacío)
- `src/hooks/useStatsLabs.ts` (crear) o `src/lib/labs/queries.ts` (crear)

**Archivos PROHIBIDOS**:
- Cualquier modal
- Cualquier componente de gráfica o dropdown
- Cualquier ruta fuera de `/laboratorios/`
- `ExpedienteCardsGrid` (esa entrada vive en sub-fase 7)
- Cualquier migración SQL nueva

**Criterios de cierre**:
- La ruta `/expediente/[id]/laboratorios` carga sin error
- Hero muestra paciente correcto con stats reales (count desde DB)
- 2 secciones renderean con su empty state
- Botones "Subir documento" y "Agregar medición" existen pero son no-ops (loggean a consola "TODO: sub-fase 6/3")
- `npm run build` verde
- Validación visual end-to-end con paciente de prueba en local

**Commit sugerido**: `feat(labs): página base /expediente/[id]/laboratorios con Hero y estados vacíos`

**Riesgos**:
- El path con `(app)` y `[id]` requiere comillas en bash — recordar al onboarding.
- Si Server Component falla por algún parámetro, validar con Zod antes de renderear.

---

### SUB-FASE 3 — Modal "Agregar medición" + autocomplete contra catálogo + analito custom

**Objetivo**: Implementar el flujo completo de captura de una medición.

**Scope atómico**:
- Crear `src/components/labs/ModalAgregarMedicion.tsx` usando ModalShell existente
- Crear `src/hooks/useCatalogoAnalitos.ts` con **SWR** (cacheado infinito porque catálogo raramente cambia — usar `revalidateOnFocus: false`, `revalidateIfStale: false`)
- Crear `src/components/labs/AutocompleteAnalito.tsx` con búsqueda por nombre + nombres_alternativos, agrupada por categoría, navegable por teclado (↑↓Enter Esc)
- Toggle "¿No encuentras el analito? Crear como custom" → cambia el form para capturar nombre + unidad + categoría custom
- Form de captura con campos:
  - Analito (autocomplete o custom)
  - Valor (numérico, con `precision_decimales` del catálogo)
  - Unidad (deshabilitada para no-custom, editable para custom)
  - Fecha (date input, default hoy)
  - Hora (time input, default ahora) — **D.2**
  - Notas (textarea opcional)
- Validación con Zod antes de enviar
- Server action `createMedicion(input: MedicionInput)`:
  - Valida que paciente pertenece a la clínica del médico
  - Valida que analito_id existe (si no custom)
  - Inserta en `mediciones_analitos`
  - Trigger SQL ya escrito sincroniza `pacientes.peso_kg/talla_cm/imc` automáticamente
  - **El audit log es automático** vía trigger genérico `log_tabla_change()` aplicado en sub-fase 1A
  - Retorna la medición creada
- Iconos desde `lucide-react`
- Conectar el botón "Agregar medición" del Hero al modal (desde sub-fase 2)
- Conectar el botón "Agregar medición" de la sección Mediciones (cuando no haya selección activa)

**Archivos PERMITIDOS**:
- `src/components/labs/ModalAgregarMedicion.tsx` (crear)
- `src/components/labs/AutocompleteAnalito.tsx` (crear)
- `src/hooks/useCatalogoAnalitos.ts` (crear)
- `src/lib/labs/actions.ts` (crear, server actions)
- `src/lib/labs/schemas.ts` (crear, schemas Zod)
- `src/components/labs/SeccionMedicionesLabs.tsx` (modificar — conectar botón al modal)
- `src/app/(app)/expediente/[id]/laboratorios/page.tsx` (modificar — montar modal)

**Archivos PROHIBIDOS**:
- ModalShell (no modificar el componente compartido)
- Schema SQL (no agregar tablas nuevas)
- Cualquier componente fuera de `/labs/`

**Criterios de cierre**:
- Abrir modal funciona desde ambos puntos de entrada
- Autocomplete filtra correctamente por nombre y sinónimos
- Toggle a custom cambia el form correctamente
- Submit crea la medición en DB
- Audit log registra el INSERT
- Trigger sincroniza `pacientes.peso_kg` cuando se captura "Peso"
- `npm run build` verde
- Validación visual: capturar 1 medición de Peso, 1 de HbA1c, 1 custom, verificar todas en DB

**Commit sugerido**: `feat(labs): modal agregar medición con autocomplete + analito custom`

**Riesgos**:
- Si el catálogo es grande (~150 entries) y el médico tiene conexión lenta, el primer fetch puede ser lento. Considerar cache en localStorage con `secureStorage` (¿catálogo es PII? — NO, es referencia clínica genérica, OK localStorage normal).
- El autocomplete debe ser keyboard-navigable (↑↓Enter Esc) — accesibilidad.

---

### SUB-FASE 4 — Dropdown selector + detail header + tabla

**Objetivo**: Cuando el paciente tiene mediciones, mostrar el dropdown selector + detalle del analito seleccionado SIN gráfica todavía (solo header + tabla).

**Scope atómico**:
- Crear `src/hooks/useAnalitosRastreados(pacienteId)` con SWR: retorna analitos que el médico ha capturado para este paciente, con su última medición
- Crear `src/components/labs/DropdownSelectorAnalito.tsx`: dropdown estilo iOS, agrupado por categoría, con búsqueda interna
- Crear `src/components/labs/AnalitoDetailHeader.tsx`: título + categoría + valor actual + tendencia (cálculo de delta vs primera medición)
- Crear `src/components/labs/TablaMediciones.tsx`: ordenada por timestamp DESC, con columna same-day indentada para múltiples mediciones del mismo día
- Crear `src/hooks/useMedicionesAnalito(pacienteId, analitoId)` con SWR: fetch de todas las mediciones del analito seleccionado
- Server action `deleteMedicion(id)`:
  - Valida ownership (paciente pertenece a clínica del médico)
  - **Hard delete** — las mediciones NO son notas clínicas (NOM-004 protege notas firmadas, no datos de seguimiento). Errores de captura deben corregirse sin dejar data errónea con `deleted_at`.
  - **Audit log automático** vía trigger genérico (registra el DELETE con OLD.id)
  - Si era una medición de antropometría, recalcular `pacientes.peso_kg/talla_cm/imc` con el siguiente más reciente (vía trigger AFTER DELETE)
- Estado de selección manejado con `useState` local + URL hash opcional para deep-linking (ej. `/laboratorios#hba1c`)
- Empty state cuando no hay mediciones aún
- Iconos desde `lucide-react`

**Archivos PERMITIDOS**:
- `src/components/labs/DropdownSelectorAnalito.tsx` (crear)
- `src/components/labs/AnalitoDetailHeader.tsx` (crear)
- `src/components/labs/TablaMediciones.tsx` (crear)
- `src/hooks/useAnalitosRastreados.ts` (crear)
- `src/hooks/useMedicionesAnalito.ts` (crear)
- `src/lib/labs/actions.ts` (modificar — agregar `deleteMedicion`)
- `src/components/labs/SeccionMedicionesLabs.tsx` (modificar — orquestar dropdown + detail)
- `supabase_migration_labs_trigger_antropometria_v2.sql` (crear si necesita AFTER DELETE además del AFTER INSERT)

**Archivos PROHIBIDOS**:
- Componente de gráfica (sub-fase 5)
- ExpedienteCardsGrid (sub-fase 7)
- Cualquier ruta fuera de `/laboratorios/`

**Criterios de cierre**:
- Dropdown muestra solo analitos rastreados, agrupados por categoría
- Búsqueda dentro del dropdown filtra correctamente
- Click en analito actualiza el detail header + tabla
- Tabla muestra mediciones DESC, con same-day indentado
- Botón eliminar funciona y respeta audit log
- Trigger AFTER DELETE recalcula antropometría correctamente
- Empty state muestra cuando paciente no tiene mediciones
- `npm run build` verde
- Validación visual end-to-end con paciente que tiene 3-5 analitos rastreados

**Commit sugerido**: `feat(labs): dropdown selector + detalle del analito + tabla de mediciones`

**Riesgos**:
- El trigger AFTER DELETE puede ser tricky si no hay mediciones restantes (qué valor poner en `pacientes.peso_kg`?). Decisión: si no hay mediciones de peso restantes, dejar `pacientes.peso_kg` con su último valor (no nullear) — el dato no es "actual" pero es lo último conocido.

---

### SUB-FASE 5 — Gráfica con bandas + tendencia + leyenda

**Objetivo**: Implementar la gráfica SVG dinámica con bandas de referencia, línea de tendencia, área bajo la curva, puntos, tooltip y leyenda.

**Scope atómico**:
- **Librería de gráficas decidida: Recharts ^3.8.1** (ya en bundle, costo marginal cero). Componentes a usar: `<LineChart>`, `<XAxis>`, `<YAxis>`, `<ReferenceArea>` (para bandas), `<Line>`, `<Tooltip>`, `<ResponsiveContainer>`.
- Crear `src/components/labs/GraficaAnalito.tsx`:
  - Recibe analito + mediciones como props
  - Calcula yMin/yMax dinámicamente (con padding del 10%)
  - Renderiza bandas con `<ReferenceArea>` según `bands_type` y rangos del catálogo (con sobreescritura por sexo si aplica)
  - Línea de tendencia con `<Line>` + área bajo la curva opcional
  - Puntos con highlight en el último (custom dot prop)
  - Tooltip con `<Tooltip>` de Recharts (interactividad full hover en todos los puntos — ventaja sobre SVG vanilla)
  - Eje X con timestamps abreviados, hora cuando hay same-day
  - `<ResponsiveContainer>` para que funcione bien en mobile
- Crear `src/components/labs/LeyendaBandas.tsx` con las etiquetas semánticas (componente propio, no `<Legend>` de Recharts porque queremos texto descriptivo)
- Crear `src/lib/labs/utils.ts` con helpers: `statusOf(value, analito, sexo)`, `getRangoEffective(analito, sexo)`, formatters de fecha
- Conectar al detail card desde sub-fase 4
- Indicador "rangos ajustados para sexo X" cuando `analito` tiene `rango_femenino` o `rango_masculino` y se está usando
- Verificar SSR: Recharts requiere `'use client'` en el componente. Marcar archivo correctamente.

**Archivos PERMITIDOS**:
- `src/components/labs/GraficaAnalito.tsx` (crear, marcar `'use client'`)
- `src/components/labs/LeyendaBandas.tsx` (crear)
- `src/lib/labs/utils.ts` (crear)
- `src/components/labs/SeccionMedicionesLabs.tsx` (modificar — montar gráfica entre header y tabla)

**Archivos PROHIBIDOS**:
- `package.json` (Recharts ya está, no instalar nada)
- Cualquier componente fuera de `/labs/`
- Cualquier migración SQL

**Criterios de cierre**:
- Gráfica renderea correctamente para cada `bands_type`: high-bad, low-bad, low-and-high-bad, none
- Sex-dependent: cuando paciente es ♂ y analito es Hemoglobina, las bandas usan `rango_masculino`
- Custom (sin bandas): solo línea de tendencia + leyenda explicativa
- Multi-day mismo día: puntos visibles correctamente (no superpuestos)
- Empty/single point: maneja casos edge sin crashear
- Tooltip funciona en hover de cualquier punto
- Mobile responsive (ResponsiveContainer)
- `npm run build` verde
- Validación visual: probar con HbA1c, TA sistólica (D.2), Hemoglobina (sex-dep), Vitamina D (low-bad), Anti-CCP (custom)

**Commit sugerido**: `feat(labs): gráfica de tendencia con Recharts y bandas de referencia`

**Riesgos**:
- Cálculo de bandas con `low-and-high-bad` puede confundir al renderear con `<ReferenceArea>`. Test exhaustivo con Hemoglobina y Creatinina.
- Recharts requiere `'use client'`; verificar que no rompe SSR del Server Component padre.
- `<ReferenceArea>` con valores fuera del dominio del gráfico puede comportarse raro — clamp a yMin/yMax.

---

### SUB-FASE 6 — Integración Documentos (extender modal global + filtrar en /labs)

**Objetivo**: Reutilizar el modal global de Documentos del expediente para que acepte los 2 tipos nuevos, y mostrar el strip de documentos clínicos (filtrado) en la página de labs.

**Scope atómico**:
- Localizar el componente del modal global de Documentos (probablemente `src/components/expediente/ModalDocumentos.tsx` o similar — verificar)
- Extender el selector de tipo del modal para incluir `'resultado_laboratorio'` y `'estudio_imagen'` con sus iconos correspondientes
- Verificar que el bucket `documentos-pdf` y las RLS policies del bucket aceptan los tipos nuevos sin cambios (probablemente sí, ya que las policies filtran por paciente, no por tipo de documento)
- En `SeccionDocumentosLabs.tsx` (creado vacío en sub-fase 2), implementar:
  - Hook `useDocumentosLabs(pacienteId)` que filtra `documentos` por `tipo IN ('resultado_laboratorio', 'estudio_imagen')`
  - Renderear strip horizontal de cards (estilo del mockup)
  - Cada card al hacer click abre el ModalVisorDocumento existente (reusar)
  - Botón "Subir documento" abre el modal global de Documentos pre-configurado con tipo `'resultado_laboratorio'` por defecto
- Empty state si no hay documentos clínicos

**Archivos PERMITIDOS**:
- `src/components/labs/SeccionDocumentosLabs.tsx` (modificar)
- `src/hooks/useDocumentosLabs.ts` (crear)
- `src/components/expediente/ModalDocumentos.tsx` (modificar — extender tipos, EVITAR cambios en lógica core)
- `src/types/index.ts` (modificar — agregar tipos al union de `TipoDocumento`)

**Archivos PROHIBIDOS**:
- Cualquier migración SQL nueva (la del CHECK ya se hizo en sub-fase 1A)
- ModalVisorDocumento (no modificar, solo reusar)

**Criterios de cierre**:
- Subir documento desde `/labs` funciona y guarda con tipo correcto
- Strip de documentos en `/labs` muestra solo lab y estudios de imagen
- Strip en `/expediente/[id]` (modal global de Documentos) sigue mostrando TODOS los tipos sin regresión
- Click en doc abre ModalVisorDocumento sin issues
- `npm run build` verde
- Validación visual end-to-end

**Commit sugerido**: `feat(labs): integración con módulo Documentos para resultados de lab y estudios`

**Riesgos**:
- Modificar el modal global puede romper otros flujos del expediente. Test de regresión obligatorio.
- Si el modal global tiene lógica de "tipo de documento sugerido por contexto", verificar que no se rompe cuando el contexto es `/labs`.

---

### SUB-FASE 7 — Card "Laboratorios" en `ExpedienteCardsGrid`

**Objetivo**: Agregar la 6ª card al grid del expediente principal para que el médico pueda navegar a la página de labs.

**Scope atómico**:
- Localizar `src/components/expediente/ExpedienteCardsGrid.tsx` (o equivalente)
- Agregar una `ExpedienteCard` con:
  - Icono representativo (chart/heartbeat)
  - Título: "Laboratorios"
  - Subtitle dinámico: si hay `>0` analitos rastreados → `"Seguimiento de N analitos"`, si no → `"Sin mediciones registradas"`
  - Click navega a `/expediente/[id]/laboratorios`
- Verificar que el grid `repeat(auto-fit, minmax(260px, 1fr))` absorbe la 6ª card sin romper en mobile (375px), tablet (768px), desktop (1280px+)
- El subtitle requiere fetch del count de analitos rastreados — reusar la query de stats de sub-fase 2 o crear una específica del card

**Archivos PERMITIDOS**:
- `src/components/expediente/ExpedienteCardsGrid.tsx` (modificar)
- `src/app/(app)/expediente/[id]/page.tsx` (modificar — pasar count como prop si necesario)
- `src/hooks/useStatsLabs.ts` (modificar si necesario — exponer query reutilizable)

**Archivos PROHIBIDOS**:
- Componente `ExpedienteCard` (no modificar el componente base)
- Cualquier archivo en `/labs/`
- Cualquier migración SQL

**Criterios de cierre**:
- Card aparece en el grid del expediente, navegando a `/laboratorios` correctamente
- Subtitle dinámico funciona (paciente con 0 mediciones vs paciente con N mediciones)
- Grid mantiene simetría visual en breakpoints clave
- `npm run build` verde
- Validación visual end-to-end

**Commit sugerido**: `feat(expediente): agregar card Laboratorios al grid del expediente principal`

**Riesgos**:
- Si el grid tiene 5 cards específicas y romperá visualmente con 6 (raro porque es auto-fit), considerar reordenar para que la card "Dashboard" y "Laboratorios" queden adyacentes (ambas son navegación a sub-vistas).

---

### SUB-FASE 8 — Migración /estado + exportador + drop tabla legacy

**Objetivo**: Migrar todos los consumidores de la tabla `laboratorios` legacy al nuevo modelo `mediciones_analitos`, eliminar el sistema legacy completo, dropear la tabla.

**Hallazgos de sub-fase 0 que modifican esta sub-fase** (ver LABS_REDISEÑO_NOTES.md completo):

Consumidores reales de la tabla `laboratorios` encontrados:
1. `src/app/(app)/expediente/[id]/page.tsx` (vía hook `useLaboratoriosNormalizados`) — dashboard /estado
2. `src/app/api/paciente/[id]/exportar/route.ts:46` — ⚠️ **producción-crítico, no previsto en plan original**. Exportador del expediente.
3. `src/app/(app)/expediente/[id]/laboratorios/[labId]/page.tsx` — página detalle legacy
4. `src/app/(app)/expediente/[id]/laboratorios/nuevo/page.tsx` — página de alta legacy
5. `src/app/api/laboratorios/route.ts` — API POST legacy
6. `src/app/api/laboratorios/[id]/route.ts` — API DELETE legacy
7. `src/hooks/useLaboratoriosNormalizados.ts` — hook legacy (el propio)

### Orden estricto de ejecución (NO reordenar)

Cada paso es un sub-commit separado para poder rollback granular si algo rompe:

**Paso 1 — Migrar el exportador del expediente** (producción-crítico primero)
- Refactorizar `src/app/api/paciente/[id]/exportar/route.ts` para leer de `mediciones_analitos` + `analitos_catalogo` en lugar de `laboratorios`
- Respetar la estructura del PDF exportado (no cambiar el layout visible al usuario — solo la fuente de datos)
- Si el exportador usa campos que solo existían en el esquema viejo (ej. `analisis_ia`), decidir: (a) omitirlos del export, (b) regenerar equivalente desde las mediciones estructuradas. Recomendación: omitir — el `analisis_ia` era una feature descartada, no debería llegar al PDF de un paciente nuevo.
- QA manual: generar el PDF de un paciente con mediciones del nuevo modelo, verificar que se ve correcto.
- Commit: `refactor(export): migrar exportador de expediente al nuevo modelo de mediciones`

**Paso 2 — Migrar /estado al nuevo modelo**
- Crear `src/hooks/useUltimasMedicionesParaDashboard.ts`: equivalente al hook viejo pero leyendo del nuevo modelo
- Refactorizar `src/app/(app)/expediente/[id]/page.tsx` para consumir el hook nuevo en lugar de `useLaboratoriosNormalizados`
- Verificar que la UI de /estado se ve igual o mejor (sin regresiones visuales)
- QA manual con paciente real
- Commit: `refactor(estado): migrar dashboard del paciente al nuevo modelo de mediciones`

**Paso 3 — Eliminar páginas legacy de /laboratorios**
- Eliminar `src/app/(app)/expediente/[id]/laboratorios/[labId]/page.tsx`
- Eliminar `src/app/(app)/expediente/[id]/laboratorios/nuevo/page.tsx`
- Eliminar carpetas vacías si quedan
- Verificar que no hay otros links apuntando a esas rutas (search por URLs hardcoded)
- `npm run build` verde
- Commit: `chore(labs): eliminar páginas legacy /laboratorios/[labId] y /laboratorios/nuevo`

**Paso 4 — Eliminar APIs legacy de /api/laboratorios**
- Eliminar `src/app/api/laboratorios/route.ts`
- Eliminar `src/app/api/laboratorios/[id]/route.ts`
- Verificar que no hay código cliente que las llame (search por `/api/laboratorios`)
- `npm run build` verde
- Commit: `chore(labs): eliminar APIs legacy POST/DELETE de /api/laboratorios`

**Paso 5 — Eliminar hook legacy**
- Eliminar `src/hooks/useLaboratoriosNormalizados.ts`
- `grep -rn "useLaboratoriosNormalizados" src/` → debe retornar 0
- `npm run build` verde
- Commit: `chore(labs): eliminar useLaboratoriosNormalizados legacy`

**Paso 6 — DROP TABLE en Supabase**
- Crear `supabase_migration_labs_drop_legacy.sql`:
  ```sql
  DROP TABLE IF EXISTS laboratorios CASCADE;
  DROP POLICY IF EXISTS "clinica_select" ON laboratorios;
  -- (las policies ya caen con CASCADE, incluir por defensa)
  ```
- **Angel ejecuta el DROP manualmente en Supabase**
- Verificar Sentry: no debe haber errores de "relation \"laboratorios\" does not exist" en las siguientes 24 horas (si aparecen, quedó un consumidor sin migrar → surfacear y resolver inline)
- Cerrar items 5 y 6 en CLAUDE.md como ✅ resueltos
- Actualizar LABS_REDISEÑO_NOTES.md con fecha de cierre
- Commit: `chore(labs): drop tabla laboratorios legacy`

**Archivos PERMITIDOS (por paso, no todos a la vez)**:
- Paso 1: `src/app/api/paciente/[id]/exportar/route.ts`
- Paso 2: `src/hooks/useUltimasMedicionesParaDashboard.ts` (crear), `src/app/(app)/expediente/[id]/page.tsx` y demás componentes de /estado (modificar)
- Paso 3: páginas legacy (eliminar)
- Paso 4: APIs legacy (eliminar)
- Paso 5: hook legacy (eliminar)
- Paso 6: `supabase_migration_labs_drop_legacy.sql` (crear), `CLAUDE.md`, `LABS_REDISEÑO_NOTES.md`

**Archivos PROHIBIDOS en cualquier paso de esta sub-fase**:
- Componentes nuevos de `/labs/` (ya construidos en sub-fases 2-6, no tocar)
- Modal global de Documentos (ya extendido en sub-fase 6)
- `ExpedienteCardsGrid` (ya actualizado en sub-fase 7)
- Cualquier feature nueva — esta sub-fase es solo refactor + cleanup

**Criterios de cierre globales de la sub-fase**:
- Los 6 commits atómicos hechos en orden
- `grep -r "useLaboratoriosNormalizados" src/` → 0 resultados
- `grep -rn "from.*laboratorios" src/` → 0 resultados (excepto lo relacionado con `mediciones_analitos` si el import usa ese nombre en substring)
- Tabla `laboratorios` dropeada en Supabase
- Sentry limpio 24h post-drop
- `/estado` y exportador funcionando idénticamente
- LABS_REDISEÑO_NOTES.md y CLAUDE.md actualizados
- Validación visual end-to-end de /estado, exportador PDF y /laboratorios con paciente real

**Commit message del último paso**: `chore(labs): drop tabla laboratorios legacy` (los commits intermedios tienen sus propios mensajes por paso).

**Riesgos**:
- **Exportador producción-crítico**: si se hace DROP antes de migrar el exportador, las exportaciones fallan en prod. Paso 1 es obligatorio primero.
- DROP TABLE es irreversible. La data de `laboratorios` es de prueba (confirmado por Angel al inicio del proyecto), borrable.
- Si aparece un 7º consumidor no detectado en sub-fase 0 (ej. agregado entre sub-fase 0 y 8 por otra feature), el build fallará. Resolver inline antes del drop.
- CASCADE elimina dependencias automáticamente pero también podría eliminar triggers/FKs de otras tablas si las hay — verificar con `SELECT * FROM information_schema.table_constraints WHERE table_name='laboratorios'` antes del drop.

---

### SUB-FASE 9 — QA end-to-end + validaciones manuales

**Objetivo**: Validación exhaustiva del sistema completo antes de declarar el rediseño cerrado.

**Scope atómico**:
- **Crear paciente de prueba** "QA Labs" con datos realistas
- **Capturar 1 medición de cada tipo** representativo:
  - Antropometría (peso) → verificar trigger sincroniza `pacientes.peso_kg`
  - Signos vitales con D.2 (3 mediciones de TAS el mismo día con horas distintas)
  - Hematología sex-dep (Hemoglobina) → verificar bandas usan `rango_masculino`
  - Química con bandas high-bad (HbA1c)
  - Hueso con bandas low-bad (Vitamina D)
  - Custom (Anti-CCP) → verificar render sin bandas
- **Subir 2 documentos**: 1 resultado de lab, 1 estudio de imagen
- **Verificar dashboard `/estado`** muestra datos correctos del nuevo modelo
- **Eliminar 1 medición** y verificar trigger AFTER DELETE recalcula antropometría
- **Probar autocomplete** con sinónimos: buscar "glicemia" debe encontrar "Glucosa"
- **Probar mobile**: sidebar colapsado, dropdown se ve bien, gráfica scrollable
- **Probar audit log**: cada acción crítica registrada
- **Lighthouse pass**: mobile y desktop, score ≥90 performance/accessibility
- **No regresiones**: visitar consultas, agenda, calculadoras, perfil — todas funcionan igual

**Archivos PERMITIDOS**:
- Solo bug fixes encontrados en QA — scope ad-hoc

**Archivos PROHIBIDOS**:
- Features nuevas (cualquier hallazgo de UX queda como deuda para próximo proyecto)

**Criterios de cierre**:
- Checklist de QA arriba 100% pass
- 0 bugs críticos
- Bugs no críticos documentados como issues separados (no bloquean cierre)
- Reporte final consolidado del rediseño completo

**Commit sugerido**: `chore(labs): QA pass + bug fixes finales del rediseño`

**Riesgos**:
- Hallazgos críticos pueden requerir abrir sub-fase 9.X — estar preparado para iterar.

---

## 3. Reglas globales del proyecto (recordar al onboarding de cada sesión)

1. **Lectura inicial obligatoria**: CLAUDE.md + LABS_REDISEÑO_PLAN.md (este archivo) + LABS_REDISEÑO_NOTES.md + sub-fase activa.
2. **Scope atómico**: solo tocar archivos en la sección "PERMITIDOS" de la sub-fase. Si necesitas tocar algo PROHIBIDO, surfacearlo y pedir permiso, no ejecutar.
3. **Diff review**: antes de aplicar cualquier cambio mostrar diff completo y esperar aprobación.
4. **NO auto-commit**: Angel hace commits manualmente.
5. **NO ejecutar SQL directamente**: generar archivos `.sql`, Angel los ejecuta en Supabase.
6. **`npm run build` verde** al cierre de cada sub-fase, antes del reporte.
7. **Paths con `(app)` y `[id]`** requieren comillas en bash: `"src/app/(app)/expediente/[id]/laboratorios/page.tsx"`.
8. **Reporte fin-de-tarea con estructura fija**:
   - Qué hice (lista atómica de cambios)
   - Archivos tocados (path completo)
   - Qué NO funcionó / cosas saltadas con razón
   - Decisiones tomadas SIN permiso explícito (debe ser cero, pero si hubo, listar)
   - Qué seguiría (sub-fase siguiente o sub-tarea pendiente)
9. **Validación visual end-to-end** antes de marcar la sub-fase como cerrada.
10. **Seguridad NO negociable**: respetar `CLAUDE.md` — no quitar audit log, no quitar RLS, no enviar PII a APIs externas, no editar notas inmutables.

---

## 4. Inventario de archivos del proyecto (lo que se creará)

### Componentes (`src/components/labs/`)
- `HeroLabs.tsx` (o reuso de HeroExpediente con variant)
- `SeccionDocumentosLabs.tsx`
- `SeccionMedicionesLabs.tsx`
- `ModalAgregarMedicion.tsx`
- `AutocompleteAnalito.tsx`
- `DropdownSelectorAnalito.tsx`
- `AnalitoDetailHeader.tsx`
- `TablaMediciones.tsx`
- `GraficaAnalito.tsx`
- `LeyendaBandas.tsx`

### Hooks (`src/hooks/`)
- `useStatsLabs.ts`
- `useCatalogoAnalitos.ts`
- `useAnalitosRastreados.ts`
- `useMedicionesAnalito.ts`
- `useDocumentosLabs.ts`
- `useUltimasMedicionesParaDashboard.ts` (reemplaza `useLaboratoriosNormalizados`)

### Lib (`src/lib/labs/`)
- `actions.ts` (server actions: createMedicion, deleteMedicion)
- `schemas.ts` (Zod schemas)
- `utils.ts` (statusOf, getRangoEffective, formatters)

### Migraciones SQL (raíz)
- `supabase_migration_labs_catalogo.sql`
- `supabase_migration_labs_mediciones.sql`
- `supabase_migration_labs_documentos_tipos.sql`
- `supabase_migration_labs_trigger_antropometria.sql`
- `supabase_migration_labs_trigger_antropometria_v2.sql` (si necesita AFTER DELETE)
- `supabase_migration_labs_seed_catalogo.sql`
- `supabase_migration_labs_drop_legacy.sql`

### Rutas (`src/app/(app)/expediente/[id]/`)
- `laboratorios/page.tsx` (nueva)

### Documentos del proyecto (raíz)
- `LABS_REDISEÑO_PLAN.md` (este archivo)
- `LABS_REDISEÑO_NOTES.md` (notas vivas, se actualiza por sub-fase)

### Modificados externos
- `CLAUDE.md` (cerrar deuda técnica en sub-fase 0 y 8)
- `src/types/index.ts` (interfaces nuevas)
- `src/types/database.types.ts` (regenerar después de cada migración SQL)
- `src/components/expediente/ExpedienteCardsGrid.tsx` (sub-fase 7)
- `src/components/expediente/ModalDocumentos.tsx` (sub-fase 6)
- Componentes de `/expediente/[id]/estado/` (sub-fase 8)

### Eliminados
- `src/components/TabGraficas.tsx` (sub-fase 0)
- `src/hooks/useLaboratoriosNormalizados.ts` (sub-fase 8)
- `src/app/(app)/expediente/[id]/laboratorios/` versión vieja (sub-fase 0 o 8)
- Tabla `laboratorios` en Supabase (sub-fase 8)
