# Fase 1 — Implementación del sistema de documentos PDF

> Plan operativo. Se lee junto con `DOCUMENTOS_HANDOFF.md`, que es la fuente de verdad del diseño.
> Arquitectura de tres capas: **tokens → chasis compartido → formatos**.

---

## Principios de ejecución

1. **Paso a paso.** Un sub-paso a la vez. No se avanza sin validación en navegador.
2. **Sin commits hasta validar.** Angel commitea manualmente. Claude Code nunca corre git, build ni push.
3. **Cada prompt declara su criterio de verificación visible:** qué tiene que verse distinto y dónde. Sin eso, se pulen cosas invisibles durante rondas.
4. **Auditoría independiente** de cada cambio de código antes de aplicarlo.
5. **WSL:** no correr `next build`. Solo `tsc --noEmit` + `eslint`.
6. Deuda transversal → `DEUDA_TECNICA.md`. Deuda de sub-paso → «Fuera de alcance» del plan operativo.

---

## Paso 0 · Consolidación del spec *(bloqueante)*

**No se escribe código hasta cerrar esto.** El spec quedó repartido entre hojas de formato y hojas de chasis; implementar así produce tokens duplicados.

**Entregable:** un solo documento `DOCUMENTOS_SPEC.md` con dos secciones estrictas.

- **Sección CHASIS** — todo lo que aplica a más de un formato: retícula, tipografía, filetes, escritura manuscrita, firmas, reglas de flujo, avisos de pie, contador de lista, sintaxis de bloques, bloque en negativo, título variable.
- **Sección POR FORMATO** — solo lo que ese formato agrega.

**Criterio de cierre:** ningún valor aparece dos veces. Si un valor está en dos formatos, sube a chasis.

**Verificación:** buscar en el documento los números `486`, `453.75`, `20 pt`, `246`, `23.25`. Cada uno debe aparecer una sola vez como definición.

---

## Paso 1 · Capa de tokens

Módulo único de constantes tipadas. **Sin componentes, sin JSX.**

**Contenido:**
- Retícula: caja 486 pt, 12 columnas de 32.25, medianil 9, riel 23.25
- Escala tipográfica: familias, cuerpos, interlineados, pesos, tracking
- Escritura manuscrita: 20 pt de alto, 246 pt de ancho, 0.8 pt de grosor
- Filetes: 4 / 3 / 2 / 1.6 / 0.8 / 0.5 pt con su uso declarado
- Espaciado: escala sobre base de 4 pt
- Color: negro, grises, y la función que deriva del acento del médico
- Umbrales de flujo: 185 pt de firma, orphans 2, widows 2
- Firmas: 77 pt y 28 pt

**Criterio de verificación:** `tsc --noEmit` limpio. Ningún literal numérico de layout fuera de este módulo en el resto del código.

---

## Paso 2 · Chasis compartido

Componentes en orden de dependencia. Cada uno se valida antes del siguiente.

| # | Componente | Notas |
|---|---|---|
| 2.A | `PanelCircular` | doble anillo, disco al 5–6 %, logo escalado sin recortar, variante monograma |
| 2.B | `Membrete` | nombre, especialidad, cédulas, **universidad obligatoria**, riel de consultorio activo |
| 2.C | `TituloDocumento` | fijo y **variable**; comportamiento de título largo; estado sin título |
| 2.D | `BloquePaciente` | nombre, edad, sexo, expediente; variante reducida para hojas de continuación |
| 2.E | `Campo` | tres estados: con valor · vacío requerido con línea · vacío opcional que colapsa |
| 2.F | `RielDatos` | celdas con etiqueta en versalita, reglas hairline |
| 2.G | `EntradaNumerada` | variante de `Tabla`; base de receta, suplementación, imagenología |
| 2.H | `BloqueNegativo` | vías y `URGENTE`; ancho variable, nunca abrevia |
| 2.I | `BloqueDestacado` | familia de filetes: alarma 3 · instrucciones 2 · cita 1.6 |
| 2.J | `ParserBloques` | sintaxis de viñetas **con lookahead** |
| 2.K | `ContadorLista` | hoja intermedia vs final |
| 2.L | `BloqueFirmas` | 1 a 6 firmas; 77 pt / 28 pt |
| 2.M | `PieDocumento` | folio, paginación, leyenda; **variante sin folio** para Escrito Médico |
| 2.N | `MotorFlujo` | las tres reglas + composición de última hoja + avisos de pie |

### El parser (2.J) es el de mayor riesgo

**Primer caso a probar, antes que cualquier otro:** prosa sin viñetas después de un bloque con viñetas. Sin lookahead se compone en versalita como si fuera título. Ese bug ya ocurrió una vez en el mockup.

**Batería mínima de pruebas:**
1. Encabezado + 2 ítems → bloque normal
2. Prosa sin viñetas, sin ítems debajo → **párrafo suelto, sin versalita, sin numerar**
3. Viñetas antes del primer encabezado → ítems con raya, no concatenados
4. Un solo ítem → **no se numera**
5. Ítem con dos puntos en medio → no se confunde con encabezado
6. Cadena vacía → colapsa entero
7. Varios bloques con contador corrido → sin números repetidos

---

## Paso 3 · Prueba de extracción de texto *(gate)*

**Se corre en cuanto exista el primer PDF real de react-pdf, antes de implementar el resto de formatos.**

Generar el PDF de un formato y correr `pdftotext`. Deben aparecer como **texto real**:

- [ ] Denominación genérica
- [ ] Nombre comercial
- [ ] Presentación y gramaje
- [ ] Vía de administración
- [ ] Indicación
- [ ] Números de entrada (`01`, `02`…)
- [ ] Folio
- [ ] `PÁGINA X DE Y`
- [ ] Etiquetas en versalita, **sin fragmentar** (`PACIENTE`, no `PAC IE NT E`)
- [ ] Ligaduras (`superficie`, no `super�cie`)

**Si falla:** el tracking está rompiendo la extracción. Usar versalitas reales de la fuente, no `letterSpacing` sobre mayúsculas. **No avanzar a otros formatos hasta que pase.**

Motivo: la denominación genérica es el único campo obligatorio por normativa, y su legibilidad por máquina es materia de la certificación NOM-024.

---

## Paso 4 · Formatos, en orden de construcción

El orden va de menor a mayor estrés sobre el chasis. Cada formato valida una capa distinta.

| # | Formato | Qué valida |
|---|---|---|
| 4.1 | **Solicitud de Laboratorio** | El chasis desnudo. Es el más simple: si aquí falla algo, es del chasis |
| 4.2 | **Solicitud de Imagenología** | Gemelo de Laboratorio + entrada de 4 datos + `URGENTE`. Valida `EntradaNumerada` y `BloqueNegativo` |
| 4.3 | **Receta Médica** | El más complejo y el de mayor volumen. Valida jerarquía de entrada, 13 vías, alarma, reglas de flujo, campo vacío |
| 4.4 | **Plan de Suplementación** | Hereda casi todo de Receta. Valida que la variante con menos props funcione sin componente paralelo |
| 4.5 | **Recibo de Honorarios / Cotización** | Única lógica de cálculo. Valida `RESERVADO PARA LA FIRMA` |
| 4.6 | **Solicitud de Internamiento** | Dos secciones, dos lectores. Valida `ParserBloques` en producción y la transición de sección |
| 4.7 | **Consentimiento Informado** | Multipágina, 6 firmas, hoja de anexo. Valida el piso de 28 pt y el ciclo de vida del documento |
| 4.8 | **Escrito Médico** | El chasis más desnudo. Valida título variable, sin folio, y la escala del cuerpo desde TipTap |

**Regla en cada formato:** si algo no cabe en un componente del chasis, se agrega **variante declarada** al componente existente. Nunca un componente paralelo. Si aparece la tentación de crear uno, el chasis está mal.

---

## Paso 5 · Cambios de formulario

Independientes del render. Se pueden hacer en paralelo a partir del Paso 3.

| Prioridad | Cambio |
|---|---|
| **Alta** | Bloquear emisión si falta universidad, cédulas o domicilio (defecto nivel 1: hoy se emiten recetas incompletas en silencio) |
| **Alta** | Receta: exigir al menos un medicamento (bug conocido) |
| Media | Catálogo de vías: quitar `parenteral`, agregar `transdérmica` → 13 |
| Media | Escrito Médico: campo de título |
| Media | Imagenología: título en app y nombre de archivo |
| Media | Cablear `numero_expediente` a los formularios |
| Media | `placeholder` que explique la sintaxis de viñetas |
| Baja | Decidir si dosis / frecuencia / duración se separan de `indicacion` |

---

## Paso 6 · Plantillas

**Solo después de que los 8 formatos rendericen.** El payload se congela con el render, no antes.

- Tabla única `plantillas_documento`
- Payload validado con Zod, esquema **por tipo de documento**
- Sin firma del médico en el payload: se toma del perfil al generar
- Aplica a los 8 formatos
- El texto prellenado de Internamiento y Escrito Médico vive aquí, **con sus viñetas incluidas** (de eso depende la degradación segura)

---

## Paso 7 · Migración

Documentos ya emitidos con el formato viejo. **Regla de inmutabilidad:** no se regeneran.
Definir cómo conviven ambos renderizadores y qué pasa al reimprimir un documento antiguo.

---

## Fuera de alcance de Fase 1

- Certificación NOM-024 ante la DGIS — proyecto aparte, prioridad máxima pre-lanzamiento
- Firma electrónica avanzada — condicional a verificar la norma
- Errores de detección de caracteres del markdown de TipTap — se revisan al entrar a Escrito Médico
- Pictogramas de vía — descartados; los SVG quedan archivados
