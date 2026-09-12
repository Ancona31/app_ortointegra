# Auditoría del sistema de documentos PDF — Spinus®

Fase de reconocimiento. **Solo lectura.** Ningún archivo de código fue modificado.
Fecha del análisis: 2026-08-03. Rama: `main`, commit base `b83cc49`.

Convención: toda afirmación lleva `archivo:línea`. Lo que no pudo determinarse
leyendo el código está marcado como **NO DETERMINADO** con la razón.

Alcance del producto respetado: no se reporta ausencia de validación de dosis,
alergias, interacciones, duplicidad terapéutica ni precios de referencia. El
contenido clínico es responsabilidad del médico.

---

## Bloque 1 — Inventario de archivos

### 1.1 Los 8 formatos

| # | Formato | Renderer | Formulario de captura |
|---|---|---|---|
| 1 | Receta | `src/lib/pdf/RecetaPdf.tsx` | `src/components/documentos/RecetaForm.tsx` |
| 2 | Solicitud de Laboratorio | `src/lib/pdf/SolicitudLabPdf.tsx` | `src/components/documentos/SolicitudLabForm.tsx` |
| 3 | Solicitud de Imagen | `src/lib/pdf/SolicitudImagenPdf.tsx` | `src/components/documentos/SolicitudImagenForm.tsx` |
| 4 | Solicitud de Internamiento | `src/lib/pdf/SolicitudInternamientoPdf.tsx` | `src/components/documentos/SolicitudInternamientoForm.tsx` |
| 5 | Plan de Suplementación | `src/lib/pdf/PlanSuplementacionPdf.tsx` | `src/components/documentos/PlanSuplementacionForm.tsx` |
| 6 | Consentimiento Informado | `src/lib/pdf/ConsentimientoInformadoPdf.tsx` | `src/components/documentos/ConsentimientoInformadoForm.tsx` |
| 7 | Escrito Médico | `src/lib/pdf/EscritoMedicoPdf.tsx` | `src/components/documentos/EscritoMedicoForm.tsx` |
| 8 | Recibo de Honorarios / Cotización | `src/lib/pdf/NotaHonorariosPdf.tsx` | `src/components/documentos/NotaHonorariosForm.tsx` |

### 1.2 Imports propios de cada renderer

**RecetaPdf.tsx** (`:2-7`) — `PdfHeader`, `PdfWatermark`, `{BarraTop, BarraBottom}`,
`{getPdfColors, contrastText}`, tipos de `PdfStyles`, `componerNombreMedicoCompleto`.
**No importa `PdfFirma`** — define su propia `FirmaInline` local (`:187-248`).

**SolicitudLabPdf.tsx** (`:2-7`) — `PdfHeader`, `PdfFirma`, `PdfWatermark`,
`{BarraTop, BarraBottom}`, `{baseStyles, getPdfColors, contrastText}`, tipos.
`baseStyles` se importa pero **no se usa en ningún punto del archivo** (import muerto).

**SolicitudImagenPdf.tsx** (`:2-7`) — mismos que Lab. `baseStyles` sí se usa
(`:210, 211, 216, 217, 220, 221, 226`).

**PlanSuplementacionPdf.tsx** (`:2-7`) — mismos que Imagen. `baseStyles` usado
(`:286-308`).

**SolicitudInternamientoPdf.tsx** (`:2-7`) — `PdfHeader`, `PdfWatermark`,
`{BarraTop, BarraBottom}`, `{baseStyles, getPdfColors, contrastText}`,
`componerNombreMedicoCompleto`. **No importa `PdfFirma`** — firma inline propia
(`:417-431` y `:463-473`).

**ConsentimientoInformadoPdf.tsx** (`:2-9`) — `PdfHeader`, `PdfWatermark`,
`{BarraTop, BarraBottom}`, `componerNombreMedicoCompleto`,
`{baseStyles, getPdfColors, contrastText}`, `Style` de `@react-pdf/types`.
**No importa `PdfFirma`** — usa `FirmaBox` local (`:87-141`) y `CompactHeader`
local (`:155-232`) que **nunca se invoca** (código muerto).

**EscritoMedicoPdf.tsx** (`:2-11`) — `PdfHeader`, `PdfFirma`, `PdfWatermark`,
`{BarraTop, BarraBottom}`, `{baseStyles, getPdfColors, contrastText}`,
`decodificarEntidadesHTML` de `@/lib/textUtils`, `JSONContent` de `@tiptap/core`.

**NotaHonorariosPdf.tsx** (`:2-7`) — `PdfHeader`, `PdfFirma`, `PdfWatermark`,
`{BarraTop, BarraBottom}`, `{getPdfColors}`, tipos.

### 1.3 Helpers compartidos

| Archivo | Líneas | Contenido |
|---|---|---|
| `src/lib/pdf/PdfStyles.tsx` | 168 | Registro de fuentes, `t()`, tipos `PdfColors`/`PdfMedicoData`/`PdfConsultorioData`, `getPdfColors`, `contrastText`, `baseStyles` |
| `src/lib/pdf/PdfHeader.tsx` | 182 | Membrete (único componente realmente compartido) |
| `src/lib/pdf/PdfBarras.tsx` | 64 | `BarraTop` y `BarraBottom` (footer) |
| `src/lib/pdf/PdfFirma.tsx` | 82 | Bloque de firma (usado por 4 de 8) |
| `src/lib/pdf/PdfWatermark.tsx` | 33 | Marca de agua |
| `src/lib/pdf/fonts.ts` | 16 (2.7 MB) | Roboto Regular/Medium/Bold/Italic en Base64 |
| `src/lib/pdf/logo.ts` | 3 (32 KB) | `LOGO_BASE64` — logo Spinus fallback |

### 1.4 Orquestadores de generación

| Archivo | Líneas | Rol |
|---|---|---|
| `src/lib/mobileShare.ts` | 271 | **Punto de entrada real.** `generarPdf()` — resuelve logo, construye elemento, renderiza, sube a Storage, entrega |
| `src/lib/pdfClientFallback.ts` | 53 | `generatePdfClient()` — registra fuentes Base64 y llama `pdf(element).toBlob()` |
| `src/app/api/generar-pdf/route.ts` | 93 | Ruta server con `renderToBuffer`. **Sin llamadas desde el código de la app** (ver Bloque 7) |
| `src/app/(app)/expediente/[id]/documentos/page.tsx` | ~115 | Hub de tabs que monta los 8 formularios |

### 1.5 Renderers adicionales fuera de los 8 (contexto)

`NotaEvolucionPdf.tsx` (590), `HojaFrontalPdf.tsx` (520),
`ExpedienteCompletoPdf.tsx` (61), `paletaNota.ts` (165). Pertenecen al pipeline
de nota médica / exportar expediente. **`NotaEvolucionPdf` es el único renderer
del proyecto que numera páginas** (`:531-533`) y el único con su propio sistema
de paleta (`paletaNota.ts`) — no comparte estilos con los 8 formatos.

### 1.6 Tabla resumen

| Formato | Archivo | Líneas | Imports propios del proyecto |
|---|---|---:|---:|
| Receta | `RecetaPdf.tsx` | 630 | 5 |
| Solicitud Lab | `SolicitudLabPdf.tsx` | 303 | 5 (1 muerto) |
| Solicitud Imagen | `SolicitudImagenPdf.tsx` | 260 | 5 |
| Internamiento | `SolicitudInternamientoPdf.tsx` | 478 | 5 |
| Plan Suplementación | `PlanSuplementacionPdf.tsx` | 392 | 5 |
| Consentimiento | `ConsentimientoInformadoPdf.tsx` | 840 | 5 |
| Escrito Médico | `EscritoMedicoPdf.tsx` | 517 | 6 |
| Honorarios | `NotaHonorariosPdf.tsx` | 410 | 5 |
| **Total 8 formatos** | | **3 830** | |
| Helpers compartidos | 5 archivos `.tsx` | 529 | |

---

## Bloque 2 — Duplicación real

### 2.1 Membrete / header

**Está en un componente compartido:** `src/lib/pdf/PdfHeader.tsx`. Los 8 formatos
lo invocan. No hay 8 copias del membrete.

Lo que **sí** está duplicado es el andamiaje que lo posiciona. Los 8 archivos
declaran, textualmente idénticos, este bloque de estilos:

```
page:        { fontFamily:'Roboto', fontSize:10, color:'#1a1a1a',
               paddingTop:100, paddingBottom:54, paddingHorizontal:50 }
headerFixed: { position:'absolute', top:0, left:0, right:0 }
headerInner: { paddingHorizontal:50, paddingTop:8 }
footerFixed: { position:'absolute', bottom:0, left:0, right:0 }
```

Ubicaciones: `RecetaPdf.tsx:258-281`, `SolicitudLabPdf.tsx:40-63`,
`SolicitudImagenPdf.tsx:34-57`, `PlanSuplementacionPdf.tsx:49-72`,
`SolicitudInternamientoPdf.tsx:41-64`, `ConsentimientoInformadoPdf.tsx:262-285`,
`EscritoMedicoPdf.tsx:401-424`, `NotaHonorariosPdf.tsx:52-75`.

**Dos divergencias en ese bloque supuestamente idéntico:**
1. `SolicitudInternamientoPdf.tsx:46` usa `paddingBottom: 42`; los otros 7 usan `54`.
2. `NotaHonorariosPdf.tsx:54` usa `fontSize: 9` de página; los otros 7 usan `10`.

El JSX del header fijo (`<View fixed>` + `<BarraTop>` + `<PdfHeader>`) también se
repite, y **más de una vez por archivo** cuando hay multipágina:

| Archivo | Instancias de `<PdfHeader>` |
|---|---:|
| Receta, Lab, Imagen, Suplementación, Escrito, Honorarios | 1 c/u |
| Internamiento | 2 (`:282`, `:440`) |
| Consentimiento | 4 (`:590`, `:695`, `:725`, `:785`) |

**Total: 14 invocaciones del mismo bloque de ~12 líneas.**

#### Por qué solo la Receta muestra la universidad

`PdfHeader` acepta una prop genérica `extraCredencial?: string`
(`PdfHeader.tsx:16`), que se renderiza en `:158-162`. **Ningún formato la llama
"universidad".** Solo `RecetaPdf.tsx:500` la puebla:

```tsx
extraCredencial={data.universidad}
```

y `RecetaData` es el único tipo de datos que declara el campo
(`RecetaPdf.tsx:26`). Del lado del formulario, solo `RecetaForm.tsx:343`
lo envía (`universidad: medicoInfo?.universidad || undefined`).

El dato **está disponible para los 8**: `useMedicoInfo` lo trae desde
`/api/me/perfil-medico` (`route.ts:14` lo selecciona, `:67` lo devuelve). Los
otros 7 formularios simplemente no construyen la prop. No hay razón técnica ni
condicional en el código — **es omisión, no diseño**. El mecanismo es genérico y
ya soporta los 8.

### 2.2 Footer

**Componente compartido:** `BarraBottom` en `src/lib/pdf/PdfBarras.tsx:21-64`.
Los 8 lo usan. Contenido: línea `cs` de 2px, banda de color `cp` con dirección,
teléfono, email y la línea de branding *"Documento generado por Spinus — La
columna vertebral de tu práctica médica"* (`PdfBarras.tsx:60`).

No hay divergencia de contenido entre formatos: los 8 pasan exactamente
`colors`, `medico` y `consultorio`. La única variable es `paddingBottom` de la
página (42 vs 54, §2.1), que determina cuánto espacio se reserva **para** la
banda — y es la causa directa del bug de superposición del Bloque 8.

El JSX `<View fixed style={s.footerFixed}><BarraBottom .../></View>` se repite
14 veces (mismo conteo que el header).

### 2.3 Bloque de firma / "FIRMA Y SELLO"

**Aquí sí hay duplicación real: existen 4 implementaciones distintas del mismo
bloque conceptual.**

| # | Implementación | Ubicación | Usado por |
|---|---|---|---|
| A | `PdfFirma` (componente compartido) | `src/lib/pdf/PdfFirma.tsx:10-82` | Lab (`:299`), Imagen (`:256`), Suplementación (`:386`), Escrito (`:513`), Honorarios (`:404`) |
| B | `FirmaInline` (local) | `RecetaPdf.tsx:187-248` | Receta (`:624`) |
| C | Firma inline sin componente | `SolicitudInternamientoPdf.tsx:417-431`, `:463-473` | Internamiento (2 veces) |
| D | `FirmaBox` (local, reutilizable ×6) | `ConsentimientoInformadoPdf.tsx:87-141` | Consentimiento (`:517-553`) |

**Diferencias exactas entre las 4:**

| Atributo | A `PdfFirma` | B `FirmaInline` | C Internamiento | D `FirmaBox` |
|---|---|---|---|---|
| Imagen de firma autógrafa | Sí, 140×52 (`:69`) | Sí, 120×44 (`:237`) | **No** | **No** |
| Ancho mínimo | 240 (`:31`) | 190 (`:201`) | `flex:1` | `48%` (`:91`) |
| Línea | `borderTopWidth:1`, color `cp`, dashed (`:33-35`) | idéntica (`:204-206`) | `borderTopWidth:1`, color **`#999`**, dashed (`:227-229`) | `borderTopWidth:1`, color `cp`, **sólida** (`:97-98`) |
| Nombre del médico | 9.5 bold, `cp` (`:41-44`) | 8.5 bold, `cp` (`:212-215`) | 9.5 bold, `cp` (`:241-244`) | 9 normal `#1a1a1a` (`:110-112`) |
| Cédulas | 7.5 `#666` (`:47-49`) | 6.5 `#666` (`:218-220`) | 7.5 `#666` (`:247-249`) | 7 `#999`, solo Céd. Prof. (`:119-122`) |
| Texto "Firma y sello" | 6, `#c0c0c0`, ls 1.5 (`:53-58`) | 5.5, `#c0c0c0`, ls 1.5 (`:224-229`) | 6, `#c0c0c0`, ls 1.5 (`:253-258`) | **Ausente** |
| `paddingTop` de la línea | 8 | 5 | 6 | 6 |
| Alineación en página | `justifyContent:'flex-end'` (`:25`) | envuelto en `flex-end` (`:481-482`) | grid 2 columnas (`:214-224`) | grid 3 filas × 2 (`:458-462`) |

Consecuencia observable: **la firma autógrafa escaneada del médico solo aparece
en 6 de los 8 formatos.** Internamiento y Consentimiento la ignoran por completo
(no leen `medico.firma_url` en ningún punto).

Además, Internamiento y Consentimiento son los únicos con **línea para firma del
paciente/familiar/testigos** (`SolicitudInternamientoPdf.tsx:418-422`,
`ConsentimientoInformadoPdf.tsx:517-553`).

### 2.4 Bloque de datos del paciente — tabla comparativa

Hay **5 implementaciones independientes** del mismo recuadro etiqueta+valor:

| Implementación | Ubicación |
|---|---|
| `baseStyles.datoField/datoLabel/datoValor` (compartido) | `PdfStyles.tsx:128-150` |
| Redefinido local en Receta | `RecetaPdf.tsx:293-340` |
| Redefinido local en Lab | `SolicitudLabPdf.tsx:85-108` |
| Redefinido local en Internamiento | `SolicitudInternamientoPdf.tsx:102-117` |
| Estilos inline puros (sin declaración) en Imagen | `SolicitudImagenPdf.tsx:209-222` |
| Grid propio `datosCell/datosCellHalf/datosCellFull` en Consentimiento | `ConsentimientoInformadoPdf.tsx:352-366` |
| Sin recuadro: `datoGroup` plano en Honorarios | `NotaHonorariosPdf.tsx:108-126` |

**Matriz formato × campo** (✓ = se imprime, — = no existe en el formato):

| Campo | Receta | Lab | Imagen | Internam. | Suplem. | Consent. | Escrito | Honor. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Nombre paciente | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (opcional) | ✓ |
| Edad | ✓ | — | — | — | — | ✓ | — | — |
| Sexo | ✓ | — | — | — | — | — | — | — |
| No. expediente | — | — | — | — | — | ✓ | — | — |
| Fecha | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hora | — | — | — | — | — | — | — | — |
| Diagnóstico | ✓ | ✓ | ✓ | ✓ | ✓ (cond.) | ✓ | — | — |
| Peso | — | — | — | — | ✓ (cond.) | — | — | — |
| Lugar | — | — | — | ✓ (hospital) | — | ✓ | — | — |
| Identificación oficial | — | — | — | — | — | ✓ | — | — |
| Familiar responsable | — | — | — | — | — | ✓ | — | — |
| Folio visible | ✓ (`Rx`) | — | — | — | — | — | — | ✓ |

Referencias: Receta `:515-541`; Lab `:255-270`; Imagen `:208-223`;
Internamiento `:307-354`; Suplementación `:286-309`; Consentimiento `:632-681`;
Escrito `:485-496`; Honorarios `:325-336`.

**Divergencias notables:**
- Solo la Receta imprime **edad y sexo**. Solo el Consentimiento imprime
  **expediente** e identificación.
- **Ningún formato imprime la hora** (ver Bloque 8.7).
- El label "PACIENTE" en Honorarios está partido por un salto de línea dentro
  del JSX (`NotaHonorariosPdf.tsx:331-333`), residuo de edición.
- Suplementación colorea los labels con `colors.cs` (`:288`), los demás con
  `colors.cp`. Consentimiento no colorea el label en absoluto (usa
  `baseStyles.datoLabel` sin override, `:634`), quedando negro.

### 2.5 Tablas de contenido

**No hay componente de tabla compartido.** Cinco formatos implementan su propia
tabla desde cero:

| Formato | Header | Filas | Columnas | Zebra |
|---|---|---|---|---|
| Receta | `:360-374` | `:375-384` | #, Medicamento, Vía, Indicaciones | `cs + '0D'` en impares |
| Lab | `:128-151` | `:161-169` | #, Estudio solicitado (×2 columnas) | `cs + '0D'` en impares |
| Imagen | `:74-122` | `:123-131` | #, Estudio, Región, Complemento | `cs + '0D'` en impares |
| Suplementación | `:101-143` | `:145-150` | #, Suplemento, Dosis, Presentación, Indicación | inline en **pares** (`:331`) |
| Honorarios | `:142-173` | `:174-180` | #, Concepto, Precio | **sin zebra**, solo líneas |

Cinco definiciones de `tableHeader`/`tblHeader`, cinco de `tableRow`, cuatro de
`tableRowAlt`. Los `paddingVertical` del header van de 3 (Receta) a 7
(Suplementación); los `fontSize` de encabezado de 6.5 (Receta) a 8 (Imagen).

#### Por qué la columna `#` es bullet en Lab e Imagen y número en Receta y Suplementación

Es una decisión escrita explícitamente y distinta en cada archivo — no hay
mecanismo compartido que lo derive:

- **Receta** — `RecetaPdf.tsx:572`: `<Text style={s.numText}>{idx + 1}</Text>`.
  Imprime el índice.
- **Suplementación** — `PlanSuplementacionPdf.tsx:334`:
  `<Text style={s.tdNum}>{i + 1}</Text>`. Imprime el índice.
- **Laboratorio** — `SolicitudLabPdf.tsx:213-215`: renderiza
  `<View style={s.bulletCol}><View style={s.bullet} /></View>`, donde `bullet`
  es un círculo de 5×5 (`:175-180`). **Descarta el índice.**
- **Imagen** — `SolicitudImagenPdf.tsx:242-244`: idéntico patrón, círculo de 6×6
  (`:137-142`).

Consecuencia: el encabezado de columna dice `#` en los cuatro
(`SolicitudLabPdf.tsx:207`, `SolicitudImagenPdf.tsx:233`), pero en Lab e Imagen
**la columna no contiene ningún número** — el encabezado miente sobre su
contenido. En Lab el problema se agrava porque el índice sí se calcula y se
pasa (`renderColumn(col1, 0)` / `renderColumn(col2, 1)`, `:279-281`), pero el
parámetro `startIdx` **nunca se usa dentro de la función** (`:203`).

### 2.6 Marca de agua

**Definición única:** `src/lib/pdf/PdfWatermark.tsx`.

- Contenedor: `position:'absolute'`, inset 0, centrado (`:8-16`).
- Imagen: `width:220, height:220, opacity:0.05, transform:'rotate(-25deg)'` (`:17-22`).
- Se monta con `<View fixed>` (`:29`) → se repite en todas las páginas.

**Acoplamiento a la imagen:** total. La firma del componente es
`{ logoUrl?: string }` (`:3-5`), hace `if (!logoUrl) return null` (`:26`) y
renderiza un `<Image src={logoUrl} />` (`:30`). **No admite renderizar texto en
su lugar sin modificar el componente** — no hay prop de texto, ni union de tipo,
ni fallback tipográfico. Si el médico no tiene logo, `generarPdf` inyecta el
logo genérico de Spinus (`mobileShare.ts:198-201`), de modo que **la marca de
agua nunca queda vacía: siempre hay logo, propio o de Spinus.**

**Supresión por formato o por prop:** no existe. Los 8 formatos la montan
incondicionalmente y ninguno pasa una prop de control. Las 14 invocaciones
(`RecetaPdf.tsx:511`, `SolicitudLabPdf.tsx:246`, `SolicitudImagenPdf.tsx:190`,
`PlanSuplementacionPdf.tsx:275`, `SolicitudInternamientoPdf.tsx:291` y `:448`,
`ConsentimientoInformadoPdf.tsx:607`, `:710`, `:740`, `:800`,
`EscritoMedicoPdf.tsx:481`, `NotaHonorariosPdf.tsx:316`) son literalmente
`<PdfWatermark logoUrl={logoUrl} />`. La única forma de suprimirla hoy es no
pasar `logoUrl`, lo que **también borra el logo del membrete** (misma variable,
ver Bloque 8.9).

### 2.7 Estimación de duplicación

Metodología: se contaron bloques textualmente idénticos o estructuralmente
equivalentes entre los 8 renderers (3 830 líneas totales).

| Concepto | Cálculo | Líneas |
|---|---|---:|
| Bloque `page/headerFixed/headerInner/footerFixed` | 24 líneas × 8 archivos | 192 |
| JSX header fijo (`View fixed` + `BarraTop` + `PdfHeader`) | ~12 líneas × 14 instancias | 168 |
| JSX footer fijo + watermark | ~5 líneas × 14 instancias | 70 |
| Bloques de firma (4 implementaciones del mismo concepto) | B+C+D redundantes frente a A | ~190 |
| Estilos `datoField/datoLabel/datoValor` redefinidos | 5 redefiniciones × ~22 | 110 |
| Tablas (header/row/rowAlt) | 5 implementaciones × ~35 | 175 |
| Boilerplate `export function renderX(props)` | 4 líneas × 8 | 32 |
| **Total duplicado** | | **~937** |

**≈ 24 % del código de los 8 renderers es duplicación directa.**

La cifra es conservadora: no cuenta la divergencia de valores literales (Bloque
3), que es duplicación conceptual con drift. Si se contabiliza el estilado
completo — cada archivo redeclara toda su escala tipográfica y su paleta de
grises — la fracción **sube a ~40-45 %**, pero esa segunda cifra es un juicio de
equivalencia, no un conteo exacto, y se marca como estimación.

---

## Bloque 3 — Estilos

### 3.1 ¿Hoja compartida o `StyleSheet.create` por formato?

**Ambas, y la compartida se usa poco.** Existe `baseStyles` en
`PdfStyles.tsx:96-168` con 8 entradas (`page`, `contenido`, `tituloDoc`,
`datoRow`, `datoField`, `datoLabel`, `datoValor`, `seccion`, `pageNumber`).

Uso real de `baseStyles` en los 8 formatos:

| Formato | Usa `baseStyles` | Detalle |
|---|---|---|
| Receta | **No** | Redefine todo (`:257-484`) |
| Lab | **No** | Lo importa (`:6`) pero no lo referencia — import muerto |
| Imagen | Sí, parcial | `datoLabel`, `datoValor`, `seccion` |
| Internamiento | Sí, parcial | `datoLabel`, `datoValor` |
| Suplementación | Sí, parcial | `datoRow`, `datoField`, `datoLabel`, `datoValor` |
| Consentimiento | Sí, parcial | `datoLabel`, `datoValor` |
| Escrito | Sí, parcial | `datoField`, `datoLabel`, `datoValor` |
| Honorarios | **No** | Redefine todo (`:50-290`) |

`baseStyles.page`, `baseStyles.contenido`, `baseStyles.tituloDoc` y
`baseStyles.pageNumber` **no los usa nadie** — son código muerto
(`PdfStyles.tsx:97-122` y `:161-167`).

Hay **17 llamadas a `StyleSheet.create`** en el directorio: Receta 2,
Consentimiento 3, Escrito 2, y 1 en cada uno de los demás archivos.

### 3.2 Valores literales hardcodeados

Conteo sobre los 8 renderers + los 5 helpers.

**Tamaños de fuente — 16 valores distintos:**
`5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 14, 16, 38`
(el 38 es el glifo "Rx" de la Receta, `PdfHeader.tsx:118`).

**Colores — 38 valores hexadecimales distintos.** Agrupados:

| Grupo | Valores | Cuenta |
|---|---|---:|
| Grises de texto | `#1a1a1a, #333, #444, #555, #666, #777, #888, #999, #aaa, #c0c0c0` | 10 |
| Grises de borde/fondo | `#d1d5db, #e5e7eb, #f8fafc, #fafafa, #fafbfc, #ffffff, #ffffffcc` | 7 |
| Semánticos rojo | `#dc2626, #fef2f2, #fca5a5, #991b1b` | 4 |
| Semánticos ámbar | `#d97706, #fffbeb, #fcd34d, #92400e, #f59e0b, #b45309, #78350f` | 7 |
| Semánticos verde | `#16a34a, #f0fdf4, #86efac, #166534` | 4 |
| Semánticos morado | `#7c3aed, #f5f3ff, #c4b5fd, #5b21b6` | 4 |
| Defaults de marca | `#004A99` (`PdfStyles.tsx:77`), `#1e5fa8` (`:78`) | 2 |

Los 4 grupos semánticos (19 colores) viven **exclusivamente** en
`RecetaPdf.tsx:56-60` (`getSemanticColors`) y en los bloques de "instrucciones"
de Internamiento (`:188-208`) y "denegación" de Consentimiento (`:472-483`).
Ningún otro formato tiene sistema semántico.

`#004A99` merece nota aparte: es el default de `cp` en
`PdfStyles.tsx:77`, pero **no coincide con el default que usa el resto del
sistema** (`#1a3a5c` en `perfil-medico/route.ts:21`, `RecetaForm.tsx:260`,
`r/[folio]/page.tsx:47` y `doctorProfile.ts:109`). Es decir: si `medico` llega
`null` al renderer, el PDF sale con un azul que no existe en ninguna otra parte
de la app.

**Padding/margin — 24 valores distintos de padding, 20 de margin:**
padding `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 26, 28, 42, 50, 54, 100`;
margin `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 24, 31, 60`.

**Grosores de borde — 9 valores distintos:**
`0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 7`.

**Otros ejes:**
- `borderRadius` — 9 valores: `1.25, 1.75, 2, 2.5, 3, 4, 8, 9, 10`
- `letterSpacing` — 7 valores: `0.3, 0.4, 0.5, 0.8, 1, 1.2, 1.5`
- `lineHeight` — 9 valores: `1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.75`

### 3.3 ¿Existe escala tipográfica o de espaciado?

**No.** No hay ninguna constante, token, objeto de escala ni módulo de diseño en
`src/lib/pdf/`. Todos los valores son literales escritos en el sitio de uso.
Los saltos de tamaño son irregulares (`5.5 → 6 → 6.5 → 7 → 7.5 → 8 → 8.5 → 9 →
9.5 → 10 → 10.5 → 11 → 12 → 14 → 16`), es decir 0.5 pt en la zona baja y 2 pt
en la alta, sin razón geométrica.

Existe en el proyecto un sistema de tokens de diseño
(`src/app/spinus-tokens.css`, con `--sp-*`) pero **no es alcanzable desde
react-pdf** — CSS custom properties no existen en el motor de PDF. No hay
puente entre ambos.

Único caso con paleta estructurada: `src/lib/pdf/paletaNota.ts` (165 líneas),
usado solo por `NotaEvolucionPdf` y `HojaFrontalPdf`. **Los 8 formatos no lo
importan.**

### 3.4 Registro de fuentes en react-pdf

Hay **dos registros distintos**, en dos rutas de código separadas:

**Ruta A — `PdfStyles.tsx:1-32`.** Se ejecuta al importar el módulo (side
effect en top level). Bifurca por entorno:
- Servidor (`typeof window === 'undefined'`): `require('path')` y
  `path.join(process.cwd(), 'public', 'fonts')` → lee del filesystem
  (`:6-17`).
- Cliente: URLs relativas `/fonts/Roboto-*.ttf` (`:19-28`).

Familia `Roboto`, 5 caras: Regular 400, Medium 500, Bold 700, Italic 400,
BoldItalic 700-italic.

**Ruta B — `pdfClientFallback.ts:15-25`.** Se ejecuta antes de cada render en
cliente. Registra `Roboto` desde `ROBOTO_FONTS` (`src/lib/pdf/fonts.ts:...`),
que es **Base64 TTF embebido en el bundle** (2.7 MB de fuente en un archivo
`.ts`), cargado con `import()` dinámico. **Solo 4 caras — falta BoldItalic.**

Consecuencia: la ruta cliente (que es la que se usa en producción, ver Bloque 7)
registra 4 caras, mientras `PdfStyles.tsx` ya registró 5 desde URLs al
importarse. El registro de `pdfClientFallback` corre después y `Font.register`
con la misma familia sobreescribe. **NO DETERMINADO:** cuál de los dos registros
gana efectivamente en runtime, y por tanto si Roboto-BoldItalic (registrada
explícitamente para el Escrito Médico, según `CLAUDE.md`) está disponible en el
cliente. Determinarlo requiere instrumentar `Font.getRegisteredFonts()` en un
render real del navegador.

`Font.registerHyphenationCallback(word => [word])` se aplica en ambas rutas
(`PdfStyles.tsx:32`, `pdfClientFallback.ts:19`) para desactivar el guionado, que
corrompía acentos.

Los archivos físicos viven en `public/fonts/Roboto-*.ttf` (ruta A) y duplicados
en Base64 dentro de `src/lib/pdf/fonts.ts` (ruta B). **La misma fuente está en
el repositorio dos veces, en dos formatos.**

---

## Bloque 4 — Cadena de datos

### 4.1 Datos del médico

**Cadena completa:**

```
tabla profiles ──┐
                 ├─→ GET /api/me/perfil-medico ──→ useMedicoInfo (SWR)
tabla clinicas ──┘
                                                          │
                                                          ▼
                                          los 8 formularios (medicoInfo)
                                                          │
                                                          ▼
                                     generarPdf({ medico: {...} })
                                                          │
                                                          ▼
                                   PdfHeader / PdfFirma / BarraBottom
```

**Origen por campo** — `src/app/api/me/perfil-medico/route.ts:12-15` (SELECT):

| Campo impreso | Tabla | Columna |
|---|---|---|
| Título (`Dr.`/`Dra.`) | `profiles` | `titulo` (default `'Dr.'`, `:39`) |
| Nombres, apellido paterno/materno | `profiles` | `nombres`, `apellido_paterno`, `apellido_materno` |
| Especialidad | `profiles` | `especialidad` |
| Cédula profesional | `profiles` | `cedula_profesional` |
| Cédula de especialidad | `profiles` | `cedula_especialidad` |
| Universidad | `profiles` | `universidad` |
| Firma autógrafa | `profiles` | `firma_url` (path) → signed URL 1 h en `:49-55` |
| Logo | `clinicas` | `logo_url` (`:32`) |
| Color primario / secundario | `clinicas` | `color_primario`, `color_secundario` (`:33-34`) |
| Nombre de la clínica | `clinicas` | `nombre_display ?? nombre` (`:35`) |

El nombre visible se compone con `componerNombreMedicoCompleto()`
(`route.ts:40-45`), y **se vuelve a componer dentro del PDF** en
`PdfHeader.tsx:22-27`, `PdfFirma.tsx:11-16`, `RecetaPdf.tsx:188-193`,
`SolicitudInternamientoPdf.tsx:266-271`, `ConsentimientoInformadoPdf.tsx:249-254`
y `:156-161`. Es decir: el campo `medico.nombre` (ya compuesto) viaja en el
payload pero los renderers lo ignoran y recomponen desde las partes.

**Contexto:** `useMedicoInfo` (`src/hooks/useMedicoInfo.ts:12-57`) usa SWR con
`dedupingInterval: 300_000` (5 min) y cachea en `secureStorage` bajo
`cache_medico_info` (`:21`) como respaldo offline. En `onSuccess` dispara
`syncDoctorProfile` (`:23`), que persiste perfil + logo + firma en Base64 en
`localStorage` bajo `spinus_doctor_profile`
(`src/lib/offline/doctorProfile.ts:12` y `:117`).

**Bifurcación offline:** los 8 formularios contienen el mismo bloque de ~20
líneas que, si `offlineMode` es true, lee `spinus_doctor_profile` de
`localStorage` y sustituye `medicoInfo`:
`RecetaForm.tsx:144-165`, `SolicitudLabForm.tsx:44-65`,
`SolicitudImagenForm.tsx:33-54`, `SolicitudInternamientoForm.tsx:49-70`,
`PlanSuplementacionForm.tsx:179-200`, `ConsentimientoInformadoForm.tsx:94-115`,
`EscritoMedicoForm.tsx:90-111`, `NotaHonorariosForm.tsx:71-92`.
**Ocho copias literales del mismo bloque.**

### 4.2 Datos del consultorio — verificación de la regla permanente

**Resultado: los 8 formularios leen de `ConsultorioActivoContext`. La regla se
cumple en los 8 formularios.**

| Formulario | Import del contexto | Construcción de `consultorioData` | Paso a `generarPdf` |
|---|---|---|---|
| Receta | `:10` | `:308-312` | `:347` |
| Lab | `:4` | `:126-130` | `:145` |
| Imagen | `:4` | `:111-115` | `:130` |
| Internamiento | `:4` | `:154-158` | `:173` |
| Suplementación | `:4` | `:287-291` | `:323` |
| Consentimiento | `:14` | `:213-217` | `:232` |
| Escrito | `:4` | `:194-198` | `:207` |
| Honorarios | `:4` | `:372-376` | `:391` |

Los 8 usan el patrón idéntico `consultorioActivo ? { nombre, direccion,
telefono } : undefined`.

**Sin embargo, los campos legacy siguen vivos como fallback y se envían siempre.**
Los 8 formularios pueblan también `direccion_consultorio` y
`telefono_consultorio` dentro del objeto `medico`:
`RecetaForm.tsx:327-328`, `SolicitudLabForm.tsx:119-120`,
`SolicitudImagenForm.tsx:104-105`, `SolicitudInternamientoForm.tsx:146-147`,
`PlanSuplementacionForm.tsx:281-282`, `ConsentimientoInformadoForm.tsx:206-207`,
`EscritoMedicoForm.tsx:186-187`, `NotaHonorariosForm.tsx:366-367`.

Y los dos consumidores en el PDF prefieren el consultorio pero caen al legacy:

- `PdfHeader.tsx:31-32` —
  `const dir = consultorio?.direccion || medico?.direccion_consultorio || ''`
- `PdfBarras.tsx:22-23` — idéntico.

**Cuatro rutas por las que los datos legacy sí llegan al papel:**

1. **Sin consultorio activo.** `ConsultorioActivoContext.tsx:49-56` devuelve
   `null` si no está hidratado, si `isLoading`, o si no hay
   `consultorioDefault`. Entonces `consultorioData` es `undefined` y el PDF
   imprime `profiles.direccion_consultorio`.
2. **Fuera del Provider.** `useConsultorioActivo` tiene fallback silencioso que
   devuelve `consultorioActivo: null` sin lanzar
   (`ConsultorioActivoContext.tsx:86-94`), documentado para el route group
   `(offline)`. Cualquier montaje fuera del Provider imprime legacy sin aviso.
3. **Regeneración desde `ModalDocumentos`.** `regenerarYSubirPdf`
   (`ModalDocumentos.tsx:99-148`) **no importa ni pasa `consultorio`**.
   Construye `medicoData` desde `getDoctorProfile()` (localStorage) con
   `direccion_consultorio` / `telefono_consultorio` legacy (`:118-119`) y llama
   `generarPdf` sin la clave `consultorio` (`:129-136`). **Todo PDF regenerado
   imprime la dirección legacy de `profiles`, no la del consultorio activo.**
4. **Modo offline.** Los 8 formularios en `offlineMode` leen
   `offlineProfile.direccion_consultorio` / `telefono_consultorio`, que
   provienen de `profiles`, no de `consultorios`.

**El email del consultorio no tiene equivalente en el contexto.**
`PdfBarras.tsx:24` lee `medico?.email_consultorio` sin fallback a consultorio, y
ese campo **no lo pobla ningún formulario ni lo devuelve
`/api/me/perfil-medico`** — está declarado en `PdfStyles.tsx:65` pero llega
siempre `undefined`. La banda del footer nunca imprime email.

### 4.3 Logo

**Almacenamiento.** Bucket `clinica-logos`, **público**
(`supabase/baseline/09_storage_buckets.sql:11-13`). Ruta
`{clinica_id}/logo.{ext}` (`src/app/api/me/logo/route.ts:36`). La URL pública se
persiste en `clinicas.logo_url` (`:53-55`).

**Procesamiento en la zona de perfil del médico** — `src/lib/compressImage.ts`,
invocado desde `src/app/(app)/perfil/page.tsx:237`:

| Pregunta | Respuesta | Referencia |
|---|---|---|
| ¿Redimensiona? | Sí, pero **solo si el archivo pesa > 150 KB**. Reduce el lado mayor 10 % por iteración hasta caber o tocar un piso de 400 px | `:17-19`, `:26`, `:49-55` |
| ¿Convierte formato? | Sí, a **PNG siempre** cuando entra a la rama de compresión (`convertToBlob({type:'image/png'})`, `:46`). Motivo declarado: preservar transparencia y porque react-pdf no soporta WebP (`:5-6`) |
| ¿Valida transparencia? | **No.** No hay inspección de canal alfa en ningún punto |
| ¿Genera derivados? | **No.** Un solo archivo, un solo tamaño. No hay thumbnail, ni variante para marca de agua, ni versión monocroma |
| ¿Bypass? | SVG se devuelve intacto (`:23`); archivos ≤ 150 KB se devuelven intactos (`:26`), **sin redimensionar ni convertir** |

Validación server-side (`api/me/logo/route.ts`): máx 500 KB (`:25-28`),
extensiones `png|jpg|jpeg|webp|svg` (`:30-33`), permiso `canManageClinica`
(`:17-19`).

El bypass de ≤ 150 KB implica que un PNG de 400×389 px y ~40 KB —el caso del
Bloque 8.9— **nunca pasa por el canvas**: se sube tal cual, con su resolución
original.

**Cómo llega al PDF** — `src/lib/mobileShare.ts:177-201`:

1. Si `logoUrl` empieza con `https://`, hace `fetch` y lo convierte a **data URL
   Base64** con `FileReader.readAsDataURL` (`:181-196`).
2. Si el fetch falla o no hay logo, importa `LOGO_BASE64` de
   `src/lib/pdf/logo.ts` — logo genérico de Spinus, PNG 300×300, ~24 KB según su
   propio comentario (`:198-201`).

Al PDF **siempre entra un data URL Base64**, nunca una URL remota. Formato PNG
(o el original si el fetch devolvió otra cosa). **Resolución: la que tenga el
archivo en el bucket — no se normaliza en ningún punto de la cadena.**

Los formularios calculan `logoUrl` de dos formas distintas:

- Receta: `medicoInfo.logo_url` si es https, si no `${origin}/logo.png`
  (`RecetaForm.tsx:296-299`) — nunca queda `undefined`.
- Los otros 7: `medicoInfo?.logo_url?.startsWith('https://') ? ... : undefined`
  (p. ej. `SolicitudLabForm.tsx:124`) — puede quedar `undefined` y caer al
  `LOGO_BASE64` de `mobileShare`.

### 4.4 Paleta de colores configurable

**Definición y almacenamiento.** Columnas `color_primario` y `color_secundario`
en la tabla `clinicas`, ambas `text`, con defaults `'#1a3a5c'` y `'#1e5fa8'`
(`supabase/baseline/02_tables.sql:210-211`). **La paleta es por clínica, no por
médico** — todos los médicos de una clínica comparten colores. Se editan en
`src/app/(app)/perfil/page.tsx` (estado `apariencia`, `:70`).

**Resolución en el momento de generar el PDF:**

1. `/api/me/perfil-medico` lee `clinicas.color_primario/secundario` con default
   `'#1a3a5c'` / `'#1e5fa8'` (`route.ts:21-22`, `:33-34`).
2. El formulario los copia a `medico.color_primario` / `color_secundario`.
3. El renderer llama `getPdfColors(medico)` → `PdfStyles.tsx:75-80`:
   `cp: medico?.color_primario ?? '#004A99'`, `cs: medico?.color_secundario ?? '#1e5fa8'`.

**Colores derivados calculados a partir del color elegido** — todos por
concatenación de alfa hexadecimal, sin espacio de color ni corrección:

| Derivado | Expresión | Ubicación |
|---|---|---|
| Fondo de sección 4 % | `colors.cp + '0A'` | `RecetaPdf.tsx:344`, `PlanSuplementacionPdf.tsx:84`, `SolicitudInternamientoPdf.tsx:123` |
| Fondo de sección 3 % | `colors.cp + '08'` | `SolicitudImagenPdf.tsx:226`, `ConsentimientoInformadoPdf.tsx:310` |
| Fondo de sección 5 % | `colors.cp + '0D'` | `ConsentimientoInformadoPdf.tsx:288` |
| Zebra de tabla 5 % | `colors.cs + '0D'` | `RecetaPdf.tsx:383`, `SolicitudLabPdf.tsx:168`, `SolicitudImagenPdf.tsx:130`, `PlanSuplementacionPdf.tsx:331` |
| Badge fondo 6 % | `colors.cp + '10'` | `SolicitudInternamientoPdf.tsx:176` |
| Badge borde 19 % | `colors.cp + '30'` | `SolicitudInternamientoPdf.tsx:181` |
| Cita de control | `colors.cs + '10'` y `colors.cs + '30'` | `PlanSuplementacionPdf.tsx:204-206` |
| Semántico "blue" de Receta | `cpColor + '08'` y `cpColor + '30'` | `RecetaPdf.tsx:60` |

Único derivado calculado de verdad: **`contrastText()`** (`PdfStyles.tsx:86-93`).
Ver Bloque 5.

`#004A99` merece nota aparte: es el default de `cp` en `PdfStyles.tsx:77`, pero
**no coincide con el default del resto del sistema** (`#1a3a5c` en
`perfil-medico/route.ts:21`, `RecetaForm.tsx:260`, `r/[folio]/page.tsx:47`,
`doctorProfile.ts:109`). Si `medico` llega `null` al renderer, el PDF sale con un
azul que no existe en ninguna otra parte de la app.

**Riesgo estructural de la concatenación de alfa:** todas las expresiones
`colors.cp + '0A'` asumen que `cp` es un hex de 7 caracteres (`#RRGGBB`). No hay
validación de formato en ningún punto de la cadena: `clinicas.color_primario` es
`text` libre, **sin CHECK constraint**. Un valor `rgb(...)`, un nombre CSS o un
hex de 4 caracteres produce una cadena inválida. **NO DETERMINADO:** el
comportamiento exacto de react-pdf ante un color inválido (¿ignora la propiedad,
lanza, o pinta negro?). Requiere ejecutarlo.

### 4.5 Datos del paciente

**Tabla `pacientes`.** No hay hook ni capa compartida: cada consumidor consulta
directo con el cliente Supabase del navegador.

| Consumidor | Query | Campos |
|---|---|---|
| Hub de documentos | `documentos/page.tsx:57` | `id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente` |
| Receta (edad y sexo) | `RecetaForm.tsx:184-188` | `fecha_nacimiento, sexo` |
| Expediente | `expediente/[id]/page.tsx:60` | `select('*')` |

El hub compone el nombre concatenando `nombre` + `apellidos`
(`documentos/page.tsx:61`) y lo pasa como `pacienteInicial` a los 8 formularios,
donde **queda en un `useState` editable** — el médico puede sobrescribirlo y el
PDF imprime el texto editado, no el registro.

La edad se calcula en cliente con `calcularEdad(fecha_nacimiento).anios`
(`RecetaForm.tsx:178`) y el sexo se mapea `M→Masculino`, `F→Femenino`
(`RecetaForm.tsx:303-306`). **Solo la Receta hace esto**; el Consentimiento pide
la edad como texto libre al médico (`ConsentimientoInformadoForm.tsx:312`).

`numero_expediente` se selecciona en el hub pero **no se pasa a ningún
formulario**. El campo "No. Expediente" del Consentimiento es entrada manual
(`ConsentimientoInformadoForm.tsx:316`), no viene del registro del paciente.

---

## Bloque 5 — Robustez de la paleta configurable

### 5.1 ¿Hay cálculo o validación de contraste?

**Sí, existe `contrastText()`** — `src/lib/pdf/PdfStyles.tsx:86-93`. Calcula
luminancia perceptual con coeficientes ITU-R BT.601 sobre valores sRGB **sin
linealizar**, umbral fijo en 0.5, y devuelve `#1a1a1a` o `#ffffff`. **No es el
ratio de contraste WCAG**, es una aproximación.

**Dónde sí se aplica** (13 puntos):

| Formato | Elemento | Línea |
|---|---|---|
| Receta | Texto del header de tabla | `:371` |
| Lab | `cpText` (`:32`) → título, header de sección, headers de tabla | `:75`, `:122`, `:140`, `:148` |
| Imagen | Título y 4 headers de tabla | `:86`, `:95`, `:104`, `:114`, `:195` |
| Suplementación | Título y 5 headers de tabla | `:113`, `:120`, `:127`, `:134`, `:141`, `:280` |
| Internamiento | Título del documento | `:77` |
| Consentimiento | Header "Datos de Identificación", títulos de sección, header de declaración | `:341`, `:395`, `:433` |
| Escrito | Banner de asunto | `:501` |
| Honorarios | — **no lo importa** | — |
| `PdfBarras` | Texto de la banda del footer | `:32` |

**Dónde NO se aplica — texto claro fijo sobre fondo del color del médico:**

| Ubicación | Código | Riesgo |
|---|---|---|
| `SolicitudImagenPdf.tsx:118-121` | `thComplementoSub: { color: '#ffffffcc' }` sobre `backgroundColor: colors.cp` (`:80`) | **Blanco fijo al 80 % sobre color configurable.** Es el caso crítico: las otras 3 columnas del mismo header sí usan `contrastText` |
| `ConsentimientoInformadoPdf.tsx:379`+`:390` | `secBadge` blanco fijo con `secBadgeNum` en `colors.cp` | Inverso: el número usa `cp` sobre blanco. Si `cp` es muy claro, el número desaparece |
| `EscritoMedicoPdf.tsx:439` | `asuntoText: { color: '#ffffff' }` | Mitigado: se sobrescribe inline con `contrastText` en `:501`. El valor del StyleSheet queda muerto |
| `PdfStyles.tsx:121` | `baseStyles.tituloDoc: { color: '#ffffff' }` | Código muerto — nadie usa `tituloDoc` |
| `SolicitudImagenPdf.tsx:67`, `SolicitudInternamientoPdf.tsx:92`, `ConsentimientoInformadoPdf.tsx:480` | Blanco sobre `#dc2626` / `#991b1b` | **Seguro:** el fondo es fijo, no configurable |

### 5.2 ¿Qué pasa con un color muy claro (amarillo, cian claro)?

Rastreado en el código. Respuesta con certeza, por formato.

Ejemplo `cp = #FFFF00`: `contrastText('#FFFF00')` calcula
`(0.299·255 + 0.587·255 + 0.114·0)/255 = 0.886 > 0.5` → devuelve `#1a1a1a`.

| Formato | Cómo pinta el título | Resultado con amarillo |
|---|---|---|
| Lab | `color: cpText` (`:75`) sobre `backgroundColor: colors.cp` (`:76`) | **Correcto** — texto casi negro sobre amarillo |
| Imagen | `color: contrastText(colors.cp)` (`:195`) sobre `colors.cp` (`:194`) | **Correcto** |
| Suplementación | `color: contrastText(colors.cp)` (`:280`) sobre `colors.cp` (`:80`) | **Correcto** |
| Internamiento | `color: contrastText(colors.cp)` (`:77`) sobre `colors.cp` (`:71`) | **Correcto** |
| Consentimiento | `tituloText.color = colors.cp` (`:299`) sobre `colors.cp + '0D'` (`:288`) | **FALLA** — texto amarillo sobre fondo amarillo al 5 % (casi blanco). Ilegible |
| Honorarios | `tituloText.color = colors.cp` (`:92`) sobre fondo de página blanco | **FALLA** — texto amarillo sobre blanco. Ilegible |
| Escrito | Banner de asunto con `contrastText` (`:501`) | **Correcto** |
| Receta | No tiene banner de título | N/A |

**Conclusión con certeza:** los títulos de **Consentimiento Informado** y
**Recibo de Honorarios** se vuelven ilegibles con un color primario claro,
porque son los dos únicos formatos que pintan el título **con** el color del
médico en lugar de **sobre** el color del médico. El mecanismo de protección
existe y funciona; esos dos casos no lo usan porque su diseño no lleva banda de
color detrás del título.

En esos dos formatos el problema se extiende más allá del título:

- Consentimiento — `secBadgeNum` (`:390`), `subtituloText` con `colors.cs`
  (`:305`), `nomBox` (`:310-312`), línea de `FirmaBox` (`:98`).
- Honorarios — `datoLabel` con `colors.cs` (`:117`), `thNum`/`thConcepto`/
  `thPrecio` con `colors.cp` (`:156`, `:162`, `:169`), `totalAmount` (`:221`),
  `notasTitle` (`:264`), y el borde inferior del título (`:83`).

**Con un color oscuro no falla ninguno**, porque `contrastText` devuelve blanco.
La paleta es segura hacia abajo y frágil hacia arriba.

### 5.3 Elementos cuyo significado depende del color

Se pierden al imprimir en blanco y negro (láser monocromo, escenario normal de
consultorio).

**Receta** — `RecetaPdf.tsx:54-181`. El formato más afectado: tiene un sistema
semántico de 5 categorías detectado por regex sobre el texto libre del médico
(`detectSemantic`, `:64-71`):

| Categoría | Disparador (regex) | Color | Qué se pierde en B/N |
|---|---|---|---|
| `red` — alarma | `alarma\|urgente\|emergencia\|acudir inmediatamente\|peligro` (`:66`) | `#dc2626` | El bloque "Datos de Alarma" (`:94-114`) queda visualmente igual que una recomendación normal. **Es la información más crítica de la receta para el paciente.** Sobrevive solo el prefijo textual `"Datos de Alarma: "` en negrita (`:110`) |
| `orange` — precaución | `evitar\|no debe\|prohibido\|restricción\|precaución` (`:67`) | `#d97706` | Las prohibiciones dejan de distinguirse de las sugerencias |
| `green` — consejo | `se recomienda\|se sugiere\|consejo` (`:68`) | `#16a34a` | Distinción de tono |
| `purple` — rehabilitación | `fisioterapia\|rehabilitación\|terapia manual\|sesiones\|ejercicio` (`:69`) | `#7c3aed` | Distinción de tono |
| `blue` — genérico | default (`:70`) | `colors.cp` | — |

El triángulo de alarma (`:108`) se dibuja con bordes de color
(`borderBottomColor: pal.bar`): en B/N queda como triángulo gris sin jerarquía.

**Solicitud de Imagen** — badge `URGENTE` (`:58-73`), fondo `#dc2626` con texto
blanco. En B/N sale caja gris oscura con texto blanco: **la palabra "URGENTE"
sobrevive**. Pérdida menor.

**Internamiento** — badge `URGENTE` (`:81-96`, mismo caso, legible) y
`instruccionesBox` (`:188-208`: fondo `#fffbeb`, borde `#f59e0b`, título
`#b45309`). Las "Instrucciones para el paciente" pierden el ámbar pero conservan
borde de 1 px y título en mayúsculas: jerarquía parcialmente preservada.

**Consentimiento** — hoja de "Denegación o Revocación" con header `#991b1b` y
texto blanco (`:472-483`). En B/N el header sale gris oscuro con texto blanco:
legible. **La señal de que esa hoja es una revocación y no una autorización pasa
a depender solo del texto del título.** Pérdida aceptable.

**Plan de Suplementación** — badge "Cita de control" (`:203-227`) con fondo
`cs + '10'` (6 %) y borde `cs + '30'` (19 %). En B/N el fondo desaparece por
completo y el borde queda casi invisible: **el badge deja de existir
visualmente**. El texto permanece pero pierde su condición de elemento
destacado.

**Receta, Lab, Imagen, Suplementación** — la zebra de tabla (`cs + '0D'`, 5 %)
desaparece en B/N. Con tablas largas se pierde el seguimiento de fila.

**Los 8** — la marca de agua al 5 % de opacidad (`PdfWatermark.tsx:20`).
**NO DETERMINADO:** si desaparece o se convierte en un manchón gris; depende del
driver de impresión, no del código.

**Lab, Imagen** — el bullet de la columna `#` (`SolicitudLabPdf.tsx:175-180`,
`SolicitudImagenPdf.tsx:137-142`) usa `backgroundColor: colors.cs`. En B/N sigue
siendo un punto. Sin pérdida real.

**Honorarios** — no tiene ningún elemento cuyo significado dependa del color.
Es el único de los ocho que es B/N-safe.

---

## Bloque 6 — Mecanismo de plantillas de Honorarios

### 6.1 Tabla de base de datos

Fuente: `supabase_migration_plantillas_honorarios.sql` (fecha declarada
2026-04-16), confirmada en el baseline (`supabase/baseline/02_tables.sql`,
`03_indexes.sql`, `06_triggers.sql`, `07_rls_policies.sql:33` y `:521-542`).

**Esquema** (`supabase_migration_plantillas_honorarios.sql:10-18`):

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` **ON DELETE CASCADE** |
| `clinica_id` | `uuid` | NOT NULL, FK → `clinicas(id)` **ON DELETE CASCADE** |
| `nombre` | `text` | NOT NULL |
| `contenido` | `jsonb` | NOT NULL, default `'{}'::jsonb` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Índices** (`:21-26`):
- `idx_plantillas_honorarios_unique_name` — **UNIQUE** sobre
  `(user_id, LOWER(TRIM(nombre)))`. Impide dos plantillas homónimas del mismo
  médico.
- `idx_plantillas_honorarios_user` — btree `(user_id, created_at DESC)`.

**Trigger** (`:53-64`): `trg_plantillas_honorarios_updated_at`, BEFORE UPDATE,
ejecuta `update_plantillas_honorarios_updated_at()` que fija `NEW.updated_at = now()`.

**RLS** (`:29-50`) — habilitado, 4 policies, todas con el mismo predicado
`user_id = auth.uid()`:

| Policy | Comando | Predicado |
|---|---|---|
| `owner_select` | SELECT | `USING (user_id = auth.uid())` |
| `owner_insert` | INSERT | `WITH CHECK (user_id = auth.uid())` |
| `owner_update` | UPDATE | `USING` + `WITH CHECK` |
| `owner_delete` | DELETE | `USING (user_id = auth.uid())` |

**Nota relevante para la generalización:** estas 4 policies **no pasan por
`clinica_tiene_acceso()` ni `clinica_no_suspendida()`**. No hay policy
RESTRICTIVE de gate de suscripción sobre esta tabla, a diferencia de las 7
tablas listadas en `CLAUDE.md`. Una clínica free degradada o suspendida sigue
pudiendo crear, editar y borrar plantillas.

### 6.2 Scope de la plantilla

**Por médico (`user_id`), no por consultorio ni por clínica.** Las 4 policies
filtran exclusivamente por `user_id = auth.uid()`. `clinica_id` se almacena
(`:13`) y se escribe en el INSERT (`NotaHonorariosForm.tsx:235`), pero **ningún
predicado ni query lo usa** — es una columna inerte. Dos médicos de la misma
clínica no ven las plantillas del otro.

No existe columna `consultorio_id`. Las plantillas son ciegas al consultorio
activo.

### 6.3 Estructura exacta del payload

Tipo declarado en `src/types/index.ts:349-360`:

```ts
export interface HonorariosTemplate {
  id: string
  nombre: string
  contenido: {
    tipoDoc: 'honorarios' | 'cotizacion'
    lineas: { concepto: string; precio: number }[]
    divisa: 'MXN' | 'USD'
    formaPago: string
    notas: string
    aseguradora: AseguradoraInfo | null
  }
}
```

Constructor del payload — `NotaHonorariosForm.tsx:205-214` (`buildContenido()`):

```ts
{
  tipoDoc,
  lineas: lineas.filter(l => l.concepto.trim() !== '')
                .map(l => ({ concepto: l.concepto, precio: l.precio })),
  divisa,
  formaPago,
  notas,
  aseguradora,
}
```

Ejemplo real de forma (sin datos de pacientes):

```json
{
  "tipoDoc": "honorarios",
  "lineas": [
    { "concepto": "Consulta de ortopedia", "precio": 1200 },
    { "concepto": "Infiltración articular", "precio": 3500 }
  ],
  "divisa": "MXN",
  "formaPago": "Transferencia bancaria",
  "notas": "Incluye una revaloración sin costo dentro de 30 días.",
  "aseguradora": { "nombre": "GNP Seguros", "poliza": "POL-123456", "cobertura": "80%" }
}
```

**Qué NO se guarda** (y por tanto se reconstruye en cada aplicación):
`paciente`, `fecha`, `folio`, `total`. El total se recalcula
(`NotaHonorariosForm.tsx:144`), la fecha se pone a hoy y el folio se regenera
(`:182-183`).

### 6.4 ¿Está versionado el esquema del payload?

**No.** No existe campo `version`, `schema`, ni discriminante de ningún tipo en
`contenido`. Contraste directo: el Escrito Médico **sí** versiona su payload con
`doc: { schema: 'tiptap-doc-v1', content }` (`EscritoMedicoForm.tsx:167`), y el
renderer bifurca con `data.doc?.schema === 'tiptap-doc-v1'`
(`EscritoMedicoPdf.tsx:453`). Honorarios no tiene ese mecanismo.

**Qué pasa hoy si el formulario cambia y hay plantillas viejas guardadas:**
`doApplyTemplate` (`NotaHonorariosForm.tsx:172-184`) desestructura sin ninguna
validación ni defensa:

```ts
const c = tpl.contenido
setTipoDoc(c.tipoDoc)      // undefined si la plantilla es previa al campo
setDivisa(c.divisa)        // undefined
setFormaPago(c.formaPago)  // undefined
setNotas(c.notas ?? '')            // sí tiene defensa
setAseguradora(c.aseguradora ?? null)  // sí tiene defensa
const newLineas = c.lineas.map(...)     // TypeError si c.lineas es undefined
```

Consecuencias concretas:
- Un campo nuevo ausente en plantillas viejas entra al estado como `undefined`.
  `setTipoDoc(undefined)` deja `tipoDoc` sin valor y `folioDisplay` (`:142`) y
  `tituloDoc` (`:143`) caen a la rama "honorarios" por comparación estricta —
  degradación silenciosa, no error.
- `setDivisa(undefined)` rompe `fmt()` (`:52-53`): `toLocaleString` con
  `currency: undefined` y `style:'currency'` lanza `RangeError`.
- **Si `c.lineas` no existe, `c.lineas.map` lanza `TypeError` y revienta el
  render** (`:179`). No hay try/catch alrededor de `doApplyTemplate` ni error
  boundary en la ruta.

No hay migración de datos, ni normalización al leer, ni saneamiento al escribir.

### 6.5 Componentes de UI

**Todo vive en un solo archivo:** `src/components/documentos/NotaHonorariosForm.tsx`
(831 líneas). No hay componente dedicado a plantillas.

| Acción | Función | Líneas | UI |
|---|---|---|---|
| Listar | `fetchTemplates()` | `:150-165` | `<select>` de plantillas, `:457-472` |
| Aplicar | `applyTemplate()` → `doApplyTemplate()` | `:186-202`, `:172-184` | `onChange` del select, `:459-462` |
| Guardar (crear) | `saveTemplate()` → `doSaveTemplate()` | `:251-275`, `:216-249` | Botón "Guardar como plantilla" + input inline, `:744-779` |
| Editar (sobrescribir) | `doSaveTemplate(name, existingId)` | `:226-231` | Mismo flujo: si el nombre existe, modal de confirmación `:264-272` |
| Borrar | `requestDeleteTemplate()` | `:278-303` | Ícono papelera junto al select, `:473-482` |
| Confirmación | `modalConfirm` state + `<Portal>` | `:133-139`, `:783-828` | Modal propio del formulario |

**No existe UI de edición del contenido de una plantilla sin aplicarla.** Editar
= aplicar al formulario, modificar, y volver a guardar con el mismo nombre.

### 6.6 Endpoints o server actions

**Ninguno.** Las 4 operaciones van **directo a Supabase desde el navegador** con
el cliente anónimo:

| Operación | Línea |
|---|---|
| SELECT | `NotaHonorariosForm.tsx:154-157` — `.from('plantillas_honorarios').select('id, nombre, contenido').order('nombre')` |
| SELECT (verificar duplicado) | `:256-259` — `.select('id').eq('nombre', name)` |
| INSERT | `:234-236` |
| UPDATE | `:227-230` |
| DELETE | `:290-293` |

No hay ruta en `src/app/api/` que toque esta tabla (verificado por búsqueda de
`plantillas_honorarios` en todo el repo: solo aparece en el formulario, la
migración y el baseline). **La única barrera es RLS.** No hay validación Zod, ni
límite de tamaño del `contenido`, ni sanitización de `nombre`.

**Fallo conocido en la resolución de `clinica_id`** —
`NotaHonorariosForm.tsx:101-108`:

```ts
const resolvedClinicaId = clinicaId ?? (() => {
  try {
    const raw = localStorage.getItem('spinus_sec_cache_user_profile')
    if (!raw) return null
    // secureStorage cifra — no podemos leer directo. Fallback: null
    return null
  } catch { return null }
})()
```

El fallback **siempre devuelve `null`** (está escrito así, con el comentario que
lo admite). Y `doSaveTemplate` aborta si falta (`:217-220`):

```ts
if (!resolvedUserId || !resolvedClinicaId) {
  toast.error('No se pudo determinar tu usuario o clínica'); return
}
```

Es decir: **guardar una plantilla solo funciona si el prop `clinicaId` llega
poblado.** El único punto de montaje del formulario es
`src/app/(app)/expediente/[id]/documentos/page.tsx:105`:

```tsx
{tab === 'honorarios' && <NotaHonorariosForm pacienteInicial={nombreCompleto} pacienteId={id} />}
```

**No pasa `userId` ni `clinicaId`.** `resolvedUserId` tiene un fallback que sí
funciona (`localStorage.spinus_session_meta`, `:95-100`), pero `resolvedClinicaId`
queda en `null` siempre por la ruta anterior. **Conclusión: en la única ruta de
UI existente, "Guardar como plantilla" falla con el toast "No se pudo determinar
tu usuario o clínica".** Aplicar, listar y borrar plantillas sí funcionan (no
requieren `clinica_id`).

**NO DETERMINADO:** si existen plantillas ya guardadas en producción. Habría que
consultar `SELECT count(*) FROM plantillas_honorarios` — no tengo acceso a la
base de datos.

### 6.7 Límites por plan de suscripción

**No existen.** No hay conteo de plantillas antes de insertar, ni consulta a
`clinicas.plan`, ni uso de `useSubscriptionGate` en el formulario. Tampoco hay
policy RESTRICTIVE de gate sobre la tabla (§6.1). Un médico puede crear
plantillas sin tope.

### 6.8 Trazabilidad de la aplicación

**Sí: el contenido cargado queda visible y editable antes de generar el PDF.**

Flujo real de la UI:

1. El médico elige una plantilla en el `<select>` (`:457-472`).
2. `onChange` (`:459-462`) llama `applyTemplate(id)`.
3. `applyTemplate` (`:186-202`) comprueba `isFormEmpty(...)` (`:57-64`). Si el
   formulario tiene datos, abre el modal de confirmación "Sobreescribir
   formulario" (`:191-198`) y **no aplica nada hasta que el médico confirma**.
4. `doApplyTemplate` (`:172-184`) escribe **exclusivamente en el estado de React
   del formulario** (`setTipoDoc`, `setDivisa`, `setFormaPago`, `setNotas`,
   `setAseguradora`, `setLineas`, `setFolio`, `setFecha`).
5. Todos esos estados están enlazados a inputs controlados y visibles: los
   conceptos y precios en la tabla editable (`:620-659`), la divisa en botones
   (`:693-706`), forma de pago en `<select>` (`:685-687`), notas en `<textarea>`
   (`:715-721`), aseguradora en 3 inputs (`:550-604`).
6. El PDF solo se genera al pulsar "Imprimir…" (`:734`), que llama `imprimir()`
   (`:331`).

**Respuesta explícita a la pregunta:** **no existe ningún camino en el que se
pueda emitir el documento sin que el contenido de la plantilla se haya mostrado
en pantalla.** Verificado por tres vías:

- `doApplyTemplate` no llama a `generarPdf` ni a `imprimir` en ninguna rama.
- `imprimir()` (`:331-443`) construye su payload **desde el estado del
  formulario** (`lineas`, `divisa`, `formaPago`, `notas`, `aseguradora`), no
  desde `tpl.contenido`. La plantilla no tiene ruta directa al PDF.
- El botón de imprimir está bloqueado por `puedeImprimir` (`:147`), que exige al
  menos una línea con concepto no vacío y precio > 0 — estado que solo puede
  existir después de que las líneas se renderizaron.

Un matiz que sí conviene registrar: `doApplyTemplate` **no toca `paciente`**
(`:172-184`). El nombre del paciente sobrevive a la aplicación de la plantilla,
lo cual es correcto, pero significa que `isFormEmpty` lo considera "intacto"
solo si coincide con `pacienteInicial` (`:58`) — si el médico editó el nombre a
mano, se dispara el modal de sobrescritura aunque no haya conceptos capturados.

### 6.9 ¿La lista muestra fecha de creación o actualización?

**No.** El SELECT solo pide `id, nombre, contenido` (`:156`) — `created_at` y
`updated_at` **ni siquiera se traen del servidor**. El tipo
`HonorariosTemplate` (`types/index.ts:349-360`) tampoco los declara. El
`<option>` renderiza únicamente `{t.nombre}` (`:470`).

El orden de la lista es `.order('nombre')` (`:157`) — alfabético, no cronológico.
El índice `(user_id, created_at DESC)` creado para ese fin
(`supabase_migration_plantillas_honorarios.sql:25-26`) **no se usa por ninguna
query del código**.

### 6.10 Reutilizabilidad tal como está

Evaluación para el objetivo declarado de generalizar el mecanismo a los 8
formatos:

| Aspecto | Estado | Reutilizable |
|---|---|---|
| Tabla | Nombre `plantillas_honorarios`, sin columna `tipo`/`formato` | **No** — habría que añadir discriminante o crear tabla genérica |
| RLS | Predicado simple `user_id = auth.uid()` | **Sí**, se traslada igual |
| Índice único | `(user_id, LOWER(TRIM(nombre)))` | **No** — sin `tipo` en la clave, un médico no podría tener "Estándar" en Receta y en Honorarios |
| Payload | `jsonb` libre, **sin versión** | Parcial — el contenedor sirve, falta el discriminante de esquema |
| UI | 100 % embebida en `NotaHonorariosForm.tsx`, sin componente extraído | **No** — hay que extraer selector, modal y lógica |
| Acceso a datos | Supabase directo desde cliente, sin capa | Parcial — funciona, pero sin validación |
| Resolución de `clinica_id` | **Rota** (`:101-108`) | **No** — bug a resolver antes de generalizar |
| Metadatos en la lista | Sin fechas | **No** |
| Gate de suscripción | Ausente | **No** — decisión pendiente |

**Resumen:** el modelo de datos y la RLS son la parte sana; la UI y el acceso a
datos están completamente acoplados al formato de Honorarios y el guardado está
inoperante en la única ruta de UI existente.

---

## Bloque 7 — Pipeline de generación y persistencia

### 7.1 Punto de entrada

El médico pulsa el botón "Imprimir …" del formulario. Los 8 llaman a una función
local `imprimir()` que termina invocando `generarPdf()` de
`src/lib/mobileShare.ts`:

| Formato | Handler | Llamada a `generarPdf` |
|---|---|---|
| Receta | `RecetaForm.tsx:236` | `:314` |
| Lab | `SolicitudLabForm.tsx:83` | `:132` |
| Imagen | `SolicitudImagenForm.tsx:69` | `:117` |
| Internamiento | `SolicitudInternamientoForm.tsx:110` | `:160` |
| Suplementación | `PlanSuplementacionForm.tsx:245` | `:293` |
| Consentimiento | `ConsentimientoInformadoForm.tsx:148` | `:219` |
| Escrito | `EscritoMedicoForm.tsx:148` | `:200` |
| Honorarios | `NotaHonorariosForm.tsx:331` | `:378` |

`generarPdf` (`mobileShare.ts:153-271`) tiene un guard de concurrencia global
(`isGenerating`, `:29` y `:163-168`) que **lanza** si ya hay una generación en
curso.

Las 6 fases declaradas (`:172-262`): resolver logo → construir elemento
(`buildClientElement`, `:32-87`, con `import()` dinámico por tipo) → renderizar a
blob → blindar MIME → subir a Storage → entregar al usuario.

### 7.2 ¿Cliente o servidor?

**Cliente, en los 8 casos.** `generarPdf` importa
`generatePdfClient` de `@/lib/pdfClientFallback` (`mobileShare.ts:211`), que
ejecuta `pdf(element).toBlob()` en el navegador (`pdfClientFallback.ts:46-47`).
El archivo lleva `'use client'` (`:8`).

**Existe una ruta server, pero está muerta.** `src/app/api/generar-pdf/route.ts`
usa `renderToBuffer` (`:80`) y registra `logAudit({ accion: 'generar_pdf' })`
(`:77`). **Ningún archivo del proyecto hace `fetch` a `/api/generar-pdf`**
(verificado por búsqueda de `renderToBuffer` y de la ruta en `src/`). Dos
consecuencias:

- La ruta es la **única** que audita la generación de un PDF, y no se ejecuta
  nunca → **la generación de documentos no deja registro en `audit_log`.**
- La ruta acepta `medico`, `data` y `logoUrl` desde el body del cliente sin
  validación de esquema (`:62-67`), y solo comprueba sesión (`:56-59`). Es
  superficie expuesta sin consumidor.

Nota: `RENDERERS` en esa ruta no propaga `consultorio` a ningún renderer
(`:31-39`) — si se reactivara, todos los PDFs saldrían con dirección legacy.

### 7.3 Subida a Storage

`mobileShare.ts:219-247`. Solo ocurre **si hay `pacienteId` y hay red**
(`:222`: `if (pacienteId && hasNetwork)`).

- **Bucket:** `documentos-pdf` (`:231`), privado
  (`supabase/baseline/09_storage_buckets.sql:16-18`).
- **Ruta:** `${pacienteId}/${finalName}` (`:228`) — un solo nivel de carpeta por
  paciente, sin partición por clínica, tipo ni fecha.
- **Convención de nombre:** `generateDocFileName(paciente, tipo)` →
  `src/lib/patientUtils.ts:134-159`:
  `{YYYY}-{MM}-{DD}_{HHmm}_{Tipo}_{Nombre_Paciente}.pdf`.
  Acentos removidos, espacios → `_`, caracteres no `[a-zA-Z0-9_-]` eliminados.
  Si no hay nombre → `Sin_Nombre`.
- **`upsert: true`** (`:234`). Dos documentos del mismo tipo, mismo paciente y
  el mismo minuto **se sobrescriben** (ver §7.7).
- Fallo de subida **no es fatal**: se loguea y `storagePath` queda `null`
  (`:237-238`), pero el PDF se entrega igual al médico y el registro en DB se
  inserta con `pdf_url: null`.

Los nombres de los tipos que pasa cada formulario:
`'Receta'`, `'Solicitud_Laboratorio'`, `'Solicitud_Imagen'`,
`'Solicitud_Internamiento'`, `'Plan_Suplementacion'`,
`'Consentimiento_Informado'`, `'Escrito_Medico'`,
`'Nota_Honorarios'` / `'Cotizacion'`.

### 7.4 Registro en base de datos

**Tabla `documentos`** (`supabase/baseline/02_tables.sql:207-234`).

Columnas escritas por los 8 formularios (patrón idéntico, p. ej.
`RecetaForm.tsx:372-381`):

| Columna | Valor |
|---|---|
| `tipo` | literal del formato |
| `contenido` | `jsonb` con todo el payload del documento |
| `client_id` | idempotencia (ver abajo) |
| `pdf_url` | `storagePath` (o `null` si falló la subida) |
| `subido_por` | `user.id` |
| `paciente_id` | solo si existe (`if (pacienteId)`) |

Columnas que quedan `null` en documentos generados: `consulta_id`,
`storage_bucket`, `storage_path`, `mime_type`, `tamaño_bytes`,
`nombre_original`. Esas 5 últimas se usan solo para **uploads clínicos**
(`src/components/labs/ModalSubirDocumento.tsx:208-218`), no para PDFs generados.
Es decir: **la ruta del PDF generado vive en `pdf_url`, no en `storage_path`** —
dos columnas para el mismo concepto según el origen.

**Folio.** No hay columna `folio`. Solo 2 de los 8 formatos generan uno y lo
guardan dentro de `contenido`:

| Formato | Generación | Formato del valor | Visible en el PDF |
|---|---|---|---|
| Receta | `RecetaForm.tsx:246` | `R-` + 12 hex de `crypto.randomUUID()` | Sí, bajo el "Rx" (`PdfHeader.tsx:168`) |
| Honorarios | `NotaHonorariosForm.tsx:40-46` | `NOH-YYYYMMDD-NNNNN` / `COT-…` | Sí (`PdfHeader.tsx:172`) |

Los otros 6 usan `crypto.randomUUID()` puro como `client_id` y **no imprimen
identificador alguno**. Comentarios explícitos en `SolicitudLabForm.tsx:89-91` y
`SolicitudImagenForm.tsx:75-76` lo confirman como decisión.

En la Receta, folio y `client_id` **son el mismo valor**
(`RecetaForm.tsx:374`: `client_id: folio`). En Honorarios **son distintos**:
`client_id` es un UUID nuevo (`:337`) y `folio` va solo dentro de `contenido`
(`:340`).

**Índice:** `idx_documentos_client_id` UNIQUE parcial sobre `client_id`
donde no es null (`supabase/baseline/03_indexes.sql:84-85`). Esto sí garantiza
unicidad del folio de Receta a nivel DB.

**Hash del archivo.** **No existe.** No hay columna de hash, ni cálculo de
digest en `mobileShare.ts`, ni en los formularios, ni en la migración de
`documentos`. Búsqueda de `sha`, `digest`, `hash` en el pipeline: sin
resultados.

### 7.5 Regeneración — `ModalDocumentos.regenerarYSubirPdf`

`src/components/expediente/ModalDocumentos.tsx:99-148`.

**Cuándo aparece el botón:** solo si `!doc.pdf_url && doc.contenido`
(`:214-231`). Es decir, únicamente para registros cuyo PDF nunca se subió (o
cuya subida falló). Si `pdf_url` existe, el botón que se muestra es "Descargar"
(`:215-221`), no "Regenerar". **No hay forma de re-emitir un documento que sí
tiene PDF.**

**Qué documentos puede regenerar:** cualquiera cuyo `doc.tipo` esté en el switch
de `buildClientElement` (`mobileShare.ts:41-86`) — los 8 formatos más
`nota_evolucion` y `expediente_completo`. `doc.tipo` se pasa sin validar
(`:130`); un tipo desconocido hace que `buildClientElement` devuelva `null` y
`generarPdf` lance "Tipo de documento no válido" (`mobileShare.ts:206`),
capturado por el `catch` (`:143-145`) que solo hace `console.error`. **El médico
no recibe ningún aviso visual del fallo.**

**Con qué datos regenera** (`:107-123`):
- `data: doc.contenido` — el payload original tal cual quedó guardado.
- `medico`: **no del perfil vivo**, sino de `getDoctorProfile()`
  (`src/lib/offline/doctorProfile.ts:34-42`), es decir **la copia en
  `localStorage`** — nombre, especialidad, cédulas, colores, dirección y
  teléfono legacy, logo y firma en Base64.
- `titulo`, `nombres`, `apellido_paterno`, `apellido_materno` sí vienen de
  `medicoInfo` vivo (`:109-112`).
- `consultorio`: **no se pasa** (§4.2).
- `filename`: `generateDocFileName(pacienteNombre, doc.tipo.replace(/_/g,'-'))`
  (`:127`, `:134`) — usa el tipo crudo con guiones, **no la etiqueta legible**
  que usó el formulario original. El nombre del archivo regenerado difiere del
  original (p. ej. `solicitud-lab` vs `Solicitud_Laboratorio`), y el timestamp es
  el de la regeneración.

Resultado: **el PDF regenerado no es idéntico al original.** Puede llevar otro
membrete (perfil cambiado desde entonces), otra dirección (legacy en vez de
consultorio), otros colores, otro logo y otro nombre de archivo. El payload
clínico sí es el mismo.

Tras subir, hace `UPDATE documentos SET pdf_url` (`:140`) y muta
`doc.pdf_url = storagePath` por referencia (`:141`) — bug ya registrado en
`CLAUDE.md` § Deuda técnica #1, con el comentario en el propio código.

**Campo de versión de formato en el registro:** **no existe.**

### 7.6 ¿Existe alguna noción de `formato_version`?

**No. Explícitamente: no existe ninguna noción de versión de formato en el
sistema.**

Verificado:
- La tabla `documentos` no tiene columna de versión
  (`supabase/baseline/02_tables.sql:207-234`).
- Ninguna migración añade una (búsqueda de `formato_version`, `version` en
  `supabase/migrations/` y en los `supabase_migration_*.sql`: sin resultados
  aplicables a `documentos`).
- El `contenido` `jsonb` no lleva discriminante de versión en 7 de los 8
  formatos.
- **Única excepción parcial:** el Escrito Médico guarda
  `doc: { schema: 'tiptap-doc-v1', content }` (`EscritoMedicoForm.tsx:167`), que
  versiona **el esquema del cuerpo del texto**, no el formato del documento.
  `EscritoMedicoPdf.tsx:453` bifurca sobre él.

Consecuencia práctica: no hay forma de saber con qué versión del renderer se
emitió un PDF histórico, ni de reproducir el aspecto original de un documento
antiguo tras un rediseño.

### 7.7 Idempotencia y sobrescritura

Dos mecanismos que interactúan mal:

1. **DB:** `client_id` UNIQUE parcial impide insertar dos veces el mismo
   documento lógico.
2. **Storage:** `upsert: true` (`mobileShare.ts:234`) con nombre derivado de
   `{fecha}_{HHmm}_{Tipo}_{Paciente}` — **resolución de un minuto**.

Si el médico emite dos documentos del mismo tipo para el mismo paciente dentro
del mismo minuto (p. ej. dos recetas corregidas seguidas), se insertan **dos
filas** en `documentos` (client_id distintos) pero **ambas apuntan al mismo
`pdf_url`**, y el segundo archivo sobrescribió al primero. El primer documento
queda con un registro válido en DB y un PDF que ya no es el suyo.

### 7.8 Acoplamiento visor ↔ generador

**El visor NO lee el PDF de Storage y NO depende del generador.** Es una tercera
implementación independiente.

Imports de `src/components/expediente/ModalVisorDocumento.tsx` (`:1-8`):

```
react (useState) · date-fns · date-fns/locale · lucide-react
@/components/ui/ModalShell
@/components/documentos/TipTapViewer
```

**No importa nada de `src/lib/pdf/` ni `src/lib/mobileShare`.** Verificado línea
por línea sobre el bloque de imports completo.

Qué hace en su lugar: renderiza HTML/JSX **desde `doc.contenido`** con un bloque
condicional por tipo — Receta (`:178-200`), Lab (`:203-220`), Imagen
(`:223-241`), Escrito (`:244-262`), Honorarios (`:265-322`), Consentimiento
(`:325-346`), Suplementación (`:349-368`). **No tiene rama para
`solicitud_internamiento`**: para ese tipo el visor muestra solo los datos
comunes (paciente, diagnóstico, fecha) y nada más.

Consecuencias:

- **Hay tres representaciones independientes de cada documento**: el PDF
  (`src/lib/pdf/*`), el visor (`ModalVisorDocumento.tsx`) y el email
  (`api/email/enviar-documento/route.ts:144-266`). Las tres leen el mismo
  `contenido` pero cada una decide por su cuenta qué campos mostrar y cómo.
  Divergen: el visor de Honorarios muestra `rfc_medico` y `rfc_paciente`
  (`:309-320`) que **ningún formulario escribe**; el email de Internamiento lee
  `contenido.hospital`, `contenido.motivo` y `contenido.tipo_internamiento`
  (`route.ts:231-233`) cuando el formulario guarda `lugar`, `justificacion` y
  `tipoInternamiento` (`SolicitudInternamientoForm.tsx:122-125`) — **el bloque
  de internamiento del email siempre sale vacío.**
- La descarga del PDF **sí** va a Storage, pero por otro camino:
  `ModalDocumentos.descargarPdf` (`:82-96`) crea una signed URL de 900 s sobre
  `documentos-pdf` y abre una pestaña. Esa función vive en `ModalDocumentos`,
  no en el visor.

**Respuesta directa:** no existe ninguna dependencia del visor hacia el
generador. El acoplamiento problemático es el inverso al esperado —
**duplicación de la lógica de presentación en tres lugares sin fuente única.**

---

## Bloque 8 — Verificación de bugs detectados

### 8.1 "FIRMA Y SELLO" superpuesto por la banda del footer (Internamiento ambas páginas, Consentimiento)

**Causa localizada.** Es la interacción de tres decisiones:

**(a) El footer es `fixed` y absoluto, fuera del flujo.**
`<View fixed style={s.footerFixed}>` con `position:'absolute', bottom:0`
(`SolicitudInternamientoPdf.tsx:59-64` y `:287`; `ConsentimientoInformadoPdf.tsx:280-285`
y `:603`, `:706`, `:736`, `:796`). El único espacio reservado para él es el
`paddingBottom` de la página.

**(b) El `paddingBottom` reservado es insuficiente y, en Internamiento, menor
que en el resto.**

| Archivo | `paddingBottom` | Línea |
|---|---:|---|
| `SolicitudInternamientoPdf.tsx` | **42** | `:46` |
| `ConsentimientoInformadoPdf.tsx` | 54 | `:267` |
| Los otros 6 | 54 | — |

Altura real de `BarraBottom` (`PdfBarras.tsx:55-62`): línea de 2 px (`:57`)
+ `paddingVertical: 12` × 2 = 24 (`:37`) + línea de contacto `fontSize 6.5`
con `marginBottom: 3` (`:41-45`) + línea de branding `fontSize 5.5` (`:47-51`).
Suma ≈ **44-46 pt con el texto de contacto en una sola línea**. Ya excede los 42
de Internamiento.

`contactText` no tiene `maxLines` ni `overflow` (`PdfBarras.tsx:40-46`) y
concatena dirección + teléfono + email (`:26-30`). **Con una dirección larga
envuelve a dos líneas** y la banda crece ~9 pt más, superando también los 54 de
Consentimiento.

**(c) El bloque de firmas se empuja al límite inferior del área de contenido.**

- Internamiento: `firmasRow` lleva `marginTop: 60` (`:215`) y va **después** del
  `<View style={{ flex: 1 }}>` que absorbe todo el espacio sobrante
  (`:293`…`:414`, firma en `:417`). El `flex:1` ya llena el área; los 60 pt
  adicionales empujan la firma más allá del borde inferior del contenido, hacia
  la franja del `paddingBottom` donde vive la banda.
  La segunda página repite el patrón: `flex:1` en `:450-460`, firma en `:463`
  con el mismo `s.firmasRow` (`marginTop: 60`). **Por eso ocurre en ambas
  páginas.**
- Consentimiento: página 3, `<View style={{ flex: 1 }}>` (`:742`…`:773`) y
  `<FirmasBlock />` fuera de él (`:776`). `firmasGrid` tiene `marginTop: 10`
  (`:462`) y contiene 6 `FirmaBox`, cada uno con `space` de 48 pt (`:93-95`) +
  línea + hasta 4 líneas de texto + `marginBottom: 24` (`:91`). Tres filas de
  ~130 pt ≈ 390 pt que arrancan al final del `flex:1`. La página 4 opcional
  repite el patrón (`:802-832` + `:835`).

**Ubicaciones exactas del defecto:**
- `src/lib/pdf/SolicitudInternamientoPdf.tsx:46` (`paddingBottom: 42`)
- `src/lib/pdf/SolicitudInternamientoPdf.tsx:215` (`firmasRow.marginTop: 60`)
- `src/lib/pdf/SolicitudInternamientoPdf.tsx:417` y `:463` (firma fuera del `flex:1`)
- `src/lib/pdf/ConsentimientoInformadoPdf.tsx:776` y `:835` (`FirmasBlock` fuera del `flex:1`)
- `src/lib/pdf/ConsentimientoInformadoPdf.tsx:91-95` (altura de cada `FirmaBox`)
- `src/lib/pdf/PdfBarras.tsx:36-46` (banda sin altura acotada)

**NO DETERMINADO:** los puntos exactos de solapamiento en pt. Calcularlos exige
medir la altura renderizada real de `BarraBottom` con la dirección concreta del
médico, que depende del texto. El mecanismo sí está confirmado por lectura.

### 8.2 Laboratorio renderiza el encabezado de una segunda columna sin filas

**Confirmado. Causa exacta:**

`src/lib/pdf/SolicitudLabPdf.tsx:35-37` parte los estudios en dos mitades:

```ts
const mid = Math.ceil(data.estudios.length / 2)
const col1 = data.estudios.slice(0, mid)
const col2 = data.estudios.slice(mid)
```

Con 1 estudio: `mid = 1`, `col1 = [estudio]`, **`col2 = []`**.

`src/lib/pdf/SolicitudLabPdf.tsx:278-282` renderiza **siempre las dos columnas,
sin condicional**:

```tsx
<View style={s.tableBody}>
  {renderColumn(col1, 0)}
  <View style={s.tableColSep} />
  {renderColumn(col2, 1)}
</View>
```

Y `renderColumn` (`:203-220`) emite el header **antes** de iterar, también sin
condicional:

```tsx
<View style={s.tableHeader}>
  <Text style={s.tableHeaderNum}>#</Text>
  <Text style={s.tableHeaderText}>Estudio solicitado</Text>
</View>
{estudios.map(...)}   // array vacío → cero filas
```

Resultado: con un número impar de estudios —y de forma más visible con uno
solo— se imprime una segunda barra de encabezado de color, del ancho de media
página, sin una sola fila debajo.

**Ubicación:** `src/lib/pdf/SolicitudLabPdf.tsx:281` (llamada incondicional) y
`:205-209` (header incondicional dentro de `renderColumn`).

Defecto adicional en la misma función: el parámetro `startIdx` (`:203`) **nunca
se usa en el cuerpo**; se pasa `0` y `1` desde `:279` y `:281` y se descarta.

### 8.3 La segunda página del Internamiento se emite con contenido casi vacío y sin nombre del paciente

**Ambas partes confirmadas.**

**(a) Condición de emisión.** `src/lib/pdf/SolicitudInternamientoPdf.tsx:435`:

```tsx
{data.indicacionesPiso ? (
  <Page size="LETTER" style={s.page}>
```

Es una comprobación de *truthiness* sobre el string crudo. **No hay `.trim()`,
ni comprobación de longitud mínima, ni de contenido significativo.** Un solo
carácter, un espacio en blanco no vacío, un salto de línea o un punto producen
una página completa con membrete, banda de footer, marca de agua, título
"Indicaciones de Ingreso a Piso", subtítulo y bloque de firma.

El campo llega desde `SolicitudInternamientoForm.tsx:94`
(`useState('')`) → `:169` (`indicacionesPiso` sin sanitizar) → `:458` del
renderer, donde se imprime tal cual: `<Text style={s.indicacionesContent}>{data.indicacionesPiso}</Text>`.

Contraste: el mismo archivo **sí** usa condicionales más estrictas en otros
bloques, p. ej. `data.requerimientos && data.requerimientos.length > 0` (`:381`).
La inconsistencia es local.

**(b) Ausencia del nombre del paciente.** La página 2 (`:436-474`) contiene:
`BarraTop` (`:438`), `PdfHeader` (`:440`), `BarraBottom` (`:445`),
`PdfWatermark` (`:448`), título (`:451-453`), subtítulo "Para personal de
enfermería y médico residente" (`:454-456`), el texto de indicaciones (`:458`) y
la firma del médico (`:463-473`).

**No hay ninguna referencia a `data.paciente` en todo el bloque.** Además, la
llamada a `PdfHeader` de la página 2 (`:440`) omite `folio` y `fecha`, que sí se
pasan en la página 1 (`:282`):

```tsx
// página 1
<PdfHeader medico={medico} colors={colors} logoUrl={logoUrl} folio={data.folio} fecha={data.fecha} compact consultorio={consultorio} />
// página 2
<PdfHeader medico={medico} colors={colors} logoUrl={logoUrl} compact consultorio={consultorio} />
```

Resultado: una hoja de indicaciones médicas hospitalarias **sin nombre de
paciente, sin fecha y sin folio** — solo con los datos del médico. Si se separa
de la página 1 (que es su uso previsto: se entrega a enfermería), es
inatribuible.

Nota: el mecanismo para resolverlo ya existe en el repositorio sin usarse —
`ConsentimientoInformadoPdf.tsx:155-232` define `CompactHeader`, que recibe
`paciente` y `procedimiento` y los imprime en la esquina derecha (`:224-227`).
**Ese componente nunca se invoca** en ningún archivo.

**Ubicaciones:** `src/lib/pdf/SolicitudInternamientoPdf.tsx:435` (condición sin
trim) y `:436-474` (página sin identificación del paciente), `:440` (header sin
fecha ni folio).

### 8.4 El Escrito Médico emite viñetas vacías

**Confirmado. Hay dos rutas de render y el saneamiento falla en ambas, por
motivos distintos.**

#### Ruta activa — JSON de TipTap

`EscritoMedicoPdf.tsx:453-455` bifurca:

```ts
const bodyElements = data.doc?.schema === 'tiptap-doc-v1'
  ? renderTipTapDoc(data.doc.content, colors)
  : parseHtmlToElements(data.cuerpo, colors)
```

Los escritos nuevos entran por la primera rama. `renderList`
(`EscritoMedicoPdf.tsx:345-362`):

```tsx
const items = node.content ?? []
return (
  <View key={key} style={{ marginVertical: 4 }}>
    {items.map((item, i) => {
      const marker = ordered ? `${start + i}.` : '•'
      return renderListItem(item, marker, ctx, depth, `${key}-i-${i}`)
    })}
  </View>
)
```

**No hay filtro sobre `items`.** Cada `listItem` del documento ProseMirror
produce un marcador, tenga o no texto. Y `renderListItem` (`:326-343`) emite el
marcador **incondicionalmente**, antes de resolver los hijos:

```tsx
<View key={itemKey} style={{ flexDirection:'row', marginLeft: depth*14, marginBottom: 2 }}>
  <Text style={{ ...ctx.bodyStyle, width: 22, textAlign:'left' }}>{marker}</Text>
  <View style={{ flex: 1 }}>
    {(item.content ?? []).map(...).filter(el => el !== null)}
  </View>
</View>
```

Un `listItem` que contiene un `paragraph` sin `content` —lo que TipTap crea al
pulsar Enter en una lista sin escribir nada, y lo que queda si el médico borra
el texto de un ítem— pasa por `renderParagraph` (`:292-299`), que devuelve un
`<Text>` con `renderInlineChildren(undefined)` → array vacío (`:269`). El
resultado es una fila con el bullet `•` y nada a su derecha.

**El `.filter(el => el !== null)` de `:339` no ayuda:** filtra nodos que
`renderNode` no reconoce (`default: return null`, `:382`), no párrafos vacíos —
`renderParagraph` siempre devuelve un elemento.

**Ubicación exacta:** `src/lib/pdf/EscritoMedicoPdf.tsx:356-359` (map sin
filtrar) y `:335` (marcador emitido antes de comprobar contenido).

#### Dónde se sanea (y qué no cubre)

`EscritoMedicoForm.tsx:28-35` — `sanitizeEditorHtml` con DOMPurify:

```ts
DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p','br','b','strong','i','em','u','h2','h3','div','span','hr','ul','ol','li'],
  ALLOWED_ATTR: ['style','class'],
  FORBID_TAGS: ['script','iframe','object','embed','form','input','link'],
  FORBID_ATTR: ['onerror','onclick','onload','onmouseover','onfocus'],
})
```

**Es saneamiento de seguridad (XSS), no de contenido.** DOMPurify no elimina
elementos vacíos: `<li></li>` es HTML perfectamente válido y sobrevive intacto.

Además, y esto es lo decisivo: el pipeline de `imprimir()`
(`EscritoMedicoForm.tsx:148-208`) sanea **solo la rama HTML**:

```ts
const docJson      = editor.getJSON()                        // :151
const htmlBruto    = generateHTML(docJson, editorExtensions) // :152
const htmlAplanado = postProcesarParaParserLegacy(htmlBruto) // :153
const cuerpoSanitizado = decodificarNbsp(sanitizeEditorHtml(htmlAplanado)) // :154
```

y luego envía **ambos** al PDF (`:204`):

```ts
data: { paciente, fecha: fechaFmt, asunto: asuntoLimpio,
        cuerpo: cuerpoSanitizado,
        doc: { schema: 'tiptap-doc-v1', content: docJson } }
```

**`docJson` va crudo, sin pasar por ninguna función de limpieza**, y es
precisamente la rama que el renderer usa. El saneamiento se aplica al campo que
el renderer ignora.

#### Ruta legacy — HTML

Para documentos anteriores a Phase 3, `parseHtmlToElements` (`:134-230`) trata
cada `<li>` como párrafo (`:199-226`) sobre segmentos producidos por
`tokenizeHtml` (`:43-89`). Ahí sí hay un filtro de vacíos parcial: `:68-70` y
`:81-85` descartan chunks cuyo `.trim()` es vacío. Pero el bullet ya no viene
del renderer: viene del texto, porque `postProcesarParaParserLegacy`
(`EscritoMedicoForm.tsx:46-68`) convierte cada `<li>` en `<p>• {texto}</p>`
(`:56`). Con un `<li>` vacío el texto resultante es `<p>• </p>` — cuyo contenido
**no** es vacío tras `trim()` (contiene el bullet), de modo que sobrevive a los
filtros de `tokenizeHtml` y se imprime como viñeta suelta.

**Ubicación:** `src/components/documentos/EscritoMedicoForm.tsx:56` y `:65`
(inyección del bullet en el texto), `:154` vs `:204` (se sanea una rama y se
envía la otra).

### 8.5 Por qué el letter-spacing rompe la extracción de texto en unos títulos y no en otros

**Mecanismo confirmado hasta el nivel del operador PDF. La razón del reparto
concreto entre formatos: NO DETERMINADO.**

#### Mecanismo (confirmado por lectura del motor)

`node_modules/@react-pdf/render/lib/index.js:117-183` (`_renderGlyphs`) agrupa
los glifos en un único operador `TJ` **salvo** cuando el avance de un glifo
difiere de su anchura nominal. Líneas `:172-175`:

```js
// Group segments that don't have any advance adjustments
if (pos.xAdvance - pos.advanceWidth !== 0) {
    addSegment(i + 1);
}
```

y `addSegment` (`:138-145`) cierra el segmento actual e inserta el ajuste:

```js
const advance = positions[cur - 1].xAdvance - positions[cur - 1].advanceWidth;
commands.push(`<${hex}> ${number(-advance)}`);
```

`letterSpacing` es exactamente lo que hace `xAdvance ≠ advanceWidth` para
**todos** los glifos. Resultado: el título deja de emitirse como
`[<cadena completa>] TJ` y pasa a emitirse como
`[<glifo> -N <glifo> -N <glifo> -N …] TJ`, un glifo por segmento. Un extractor de
texto que interprete cada ajuste negativo grande como separación de palabra
devuelve la cadena letra por letra.

El valor del ajuste en milésimas de em es `letterSpacing × 1000 / fontSize`
(el escalado se aplica en `:186-190`: `scale = 1000 / ctx._fontSize`).

#### Valores reales de los 6 títulos con `letterSpacing`

| Formato | Ubicación | `letterSpacing` | `fontSize` | Ajuste por glifo | Extracción observada |
|---|---|---:|---:|---:|---|
| Laboratorio | `SolicitudLabPdf.tsx:74` (en el `View`, `:65-77`) | 1.5 | 12 | 125 | **Rota** |
| Suplementación | `PlanSuplementacionPdf.tsx:280` (en el `Text`) | 1.5 | 12 | 125 | **Rota** |
| Internamiento | `SolicitudInternamientoPdf.tsx:78` (`tituloText`) | 1.5 | 12 | 125 | **Rota** |
| Imagen | `SolicitudImagenPdf.tsx:195` (en el `Text`) | 1.5 | 12 | 125 | Correcta |
| Consentimiento | `ConsentimientoInformadoPdf.tsx:300` (`tituloText`) | 1.2 | 14 | 86 | Correcta |
| Honorarios | `NotaHonorariosPdf.tsx:93` (`tituloText`) | 1.5 | 11 | **136** | Correcta |

#### Por qué no puedo cerrar la causa del reparto

Tres hipótesis quedan descartadas por los propios datos:

1. **Magnitud del ajuste.** Honorarios tiene el ajuste **mayor** de los seis
   (136) y extrae bien; Imagen tiene exactamente el mismo valor que
   Suplementación (125) y una extrae bien y la otra no. No hay umbral que
   separe los dos grupos.
2. **Dónde se declara el estilo (`View` vs `Text`).** Laboratorio lo declara en
   el `View` contenedor (`:65-77`, aplicado en `:250`) y falla; Suplementación e
   Internamiento lo declaran en el `Text` y también fallan; Imagen lo declara en
   el `Text` y funciona. La ubicación no correlaciona.
3. **Longitud o composición del texto.** "Plan de Suplementación" (22 caracteres,
   con acento) falla; "Solicitud de Estudios de Imagen" (31, sin acento)
   funciona; "Solicitud de Estudios de Laboratorio" (35, sin acento) falla.
   Ni longitud ni acentos separan los grupos.

Imagen y Suplementación tienen títulos con **estilo tipográfico idéntico**
(`fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5,
textAlign:'center'`, dentro de un `View` con `alignItems:'center'` y
`backgroundColor: colors.cp`) y comportamiento opuesto. **Con el código a la
vista, la diferencia no es explicable.**

**Qué haría falta para determinarlo:** volcar el flujo de contenido de los PDFs
de ambos formatos (`qpdf --qdf --object-streams=disable salida.pdf`) y comparar
los operadores `TJ` reales del título, y ejecutar el mismo extractor sobre los
seis archivos para descartar que la diferencia venga de la herramienta de
extracción usada en la observación y no del PDF. Sin esos dos artefactos
cualquier explicación sería una suposición.

**Lo que sí queda establecido:** `letterSpacing` fuerza la fragmentación
por glifo en los seis títulos, sin excepción. La cuestión abierta es únicamente
por qué tres extractores devuelven la cadena reunida y tres no.

### 8.6 Ningún documento incluye numeración de páginas

**Confirmado, y confirmado también que react-pdf sí lo soporta y está en uso en
otro renderer del proyecto.**

Búsqueda de `render={(` y `pageNumber` en `src/lib/pdf/`:

| Archivo | Resultado |
|---|---|
| Los 8 formatos | **Cero coincidencias** |
| `NotaEvolucionPdf.tsx:531-533` | **Sí lo usa**: `render={({ pageNumber, totalPages }) => ... 'Pág. ' + pageNumber + ' de ' + totalPages}` |
| `ExpedienteCompletoPdf.tsx:10` | Comentario que documenta la numeración continua |
| `PdfStyles.tsx:161-167` | Estilo `pageNumber` **declarado** (`position:'absolute', bottom:48, right:50, fontSize:7, color:'#aaa'`) |

`baseStyles.pageNumber` existe, tiene coordenadas coherentes con el resto del
sistema, y **ningún archivo lo referencia**. Es un estilo escrito para una
funcionalidad que nunca se cableó.

Los 49 usos de `fixed` en `src/lib/pdf/*.tsx` son todos para header, footer y
marca de agua. **Ninguno lleva la prop `render`**, que es la que react-pdf exige
para inyectar `pageNumber`/`totalPages`.

Impacto directo en los formatos multipágina: Internamiento (2 páginas) y
Consentimiento (3 o 4 páginas) se emiten sin ninguna marca de paginación ni de
total. No hay forma de detectar una hoja faltante en un expediente físico.

### 8.7 Ningún documento incluye hora, aunque el nombre del archivo sí

**Confirmado en ambos extremos.**

**El PDF solo lleva fecha.** Los 8 formularios formatean la fecha con la misma
máscara, sin componente horario:

```ts
format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
```

`RecetaForm.tsx:287`, `SolicitudLabForm.tsx:106`, `SolicitudImagenForm.tsx:91`,
`SolicitudInternamientoForm.tsx:151`, `PlanSuplementacionForm.tsx:267`,
`ConsentimientoInformadoForm.tsx:211`, `EscritoMedicoForm.tsx:192`,
`NotaHonorariosForm.tsx:353`.

El `T12:00:00` es un ancla mediodía para evitar corrimientos de zona horaria, no
una hora real: el input de origen es `<input type="date">` (p. ej.
`RecetaForm.tsx:411`), que no captura hora.

**El nombre del archivo sí la lleva.** `generateDocFileName`
(`src/lib/patientUtils.ts:134-159`):

```ts
const hh  = String(d.getHours()).padStart(2, '0')     // :143
const min = String(d.getMinutes()).padStart(2, '0')   // :144
const timestamp = `${yyyy}-${mm}-${dd}_${hh}${min}`   // :146
return `${timestamp}_${tipo}_${paciente}.pdf`         // :158
```

**La hora del archivo no es la hora del documento:** `d = fecha ?? new Date()`
(`:139`) y los 8 formularios llaman sin argumento de fecha, así que es la hora
del *momento de generación*, mientras que la fecha impresa es la que el médico
eligió en el input (que puede ser retroactiva).

**Sí existe hora en la base de datos**, en dos formas: `documentos.created_at`
(`supabase/baseline/02_tables.sql:214`) y `contenido.timezone`, capturado con
`Intl.DateTimeFormat().resolvedOptions().timeZone` por 5 de los 8 formularios
(`RecetaForm.tsx:254`, `SolicitudInternamientoForm.tsx:127`,
`ConsentimientoInformadoForm.tsx:185`, `EscritoMedicoForm.tsx:169`,
`NotaHonorariosForm.tsx:347`). **Lab, Imagen y Suplementación no lo capturan.**
Ninguno de los ocho lleva hora al papel.

La página pública de verificación **sí** muestra hora
(`src/app/r/[folio]/page.tsx:56-60`, `hour:'2-digit', minute:'2-digit'`),
tomándola de `created_at`. Es decir: **la receta impresa no dice la hora, pero el
QR de esa misma receta la revela.**

### 8.8 Campos vacíos se renderizan como cajas con etiqueta y sin contenido

**Confirmado. No existe ninguna regla de manejo de campo vacío en el código: los
bloques se renderizan siempre.** La causa raíz es el uso de `??` (nullish
coalescing) sobre valores que nunca son `null` ni `undefined`, sino `''`.

`??` solo sustituye `null`/`undefined`. Los formularios inicializan **todos** los
campos de texto con `useState('')`, y los inputs controlados nunca los devuelven
a `undefined`. Por tanto el fallback `'—'` **jamás se dispara** para un campo que
el médico dejó en blanco.

**Consentimiento** (`ConsentimientoInformadoPdf.tsx`):

| Campo | Renderer | Origen del `''` | Resultado |
|---|---|---|---|
| `NO. EXPEDIENTE` | `:642-643` — `{data?.expediente ?? '—'}` | `ConsentimientoInformadoForm.tsx:122` `useState('')` | Caja con label y valor vacío |
| `IDENTIFICACIÓN PACIENTE` | `:654-655` — `{data?.idPaciente ?? '—'}` | `:124` `useState('')` | Ídem |
| `IDENTIFICACIÓN FAMILIAR` | `:662-663` — `{data?.idFamiliar ?? '—'}` | `:127` `useState('')` | Ídem |

Los tres son campos **opcionales** en el formulario (no llevan asterisco:
`:315-316`, `:319-320`, `:335-336`) y no están en la lista de obligatorios
(`:154-164`), de modo que el caso vacío es el normal, no el excepcional.

Las celdas se emiten sin condicional alguno: `<View style={s.datosCell}>` fijo
en `:641`, `:653`, `:661`. Contraste dentro del mismo archivo: el bloque de
Representante Legal **sí** es condicional (`:665-676`,
`{data?.representante ? (...) : null}`). La inconsistencia es local, no de
diseño.

**Laboratorio e Imagen — `DIAGNÓSTICO` sin ningún fallback:**

- `SolicitudLabPdf.tsx:266-269`:
  ```tsx
  <View style={s.datoField}>
    <Text style={s.datoLabel}>DIAGNÓSTICO</Text>
    <Text style={s.datoValor}>{data.diagnostico}</Text>
  </View>
  ```
  Sin `??`, sin condicional. `SolicitudLabForm.tsx:69` inicializa
  `useState(diagnosticoInicial)` y el hub pasa `searchParams.get('dx') || ''`
  (`documentos/page.tsx:62`). Si el médico entra sin `?dx=` y no escribe nada
  (el campo **no es obligatorio**, `:208-209` sin asterisco; el botón solo exige
  paciente y estudios, `:259`), se imprime una caja bordeada con la etiqueta
  DIAGNÓSTICO y nada dentro.

- `SolicitudImagenPdf.tsx:219-222`: idéntico patrón con estilos inline.
  `SolicitudImagenForm.tsx:58` y `:244` confirman que tampoco es obligatorio.

**Comparación con los formatos que sí lo manejan bien:** Suplementación envuelve
sus campos opcionales en condicionales reales —
`{data?.peso ? (...) : null}` (`PlanSuplementacionPdf.tsx:297-302`) y
`{data?.diagnostico ? (...) : null}` (`:303-308`) — y por eso no produce cajas
vacías. Internamiento hace lo mismo con `fechaIngreso`, `lugar`,
`tipoInternamiento`, `diasEstimados` y `asa` (`:316-353`).

**Conclusión:** el patrón correcto existe en el repositorio y está aplicado en 2
de los 8 formatos. No es una carencia de mecanismo, es una aplicación
inconsistente.

**Caso aparte — el `'—'` que sí funciona:** en la Receta,
`{data?.edad ?? '—'}` (`:524`) y `{data?.sexo ?? '—'}` (`:528`) **sí** muestran
el guion, porque `RecetaForm.tsx:336-337` envía explícitamente `undefined`
cuando no hay dato (`edadPaciente != null ? ... : undefined`). Es el único
formulario que respeta el contrato que el renderer espera.

### 8.9 El logo se instancia dos veces por página desde el mismo PNG

**Confirmado. Ambas instancias reciben la misma cadena Base64 y la dimensionan
de forma distinta e independiente.**

Una sola variable `logoUrl` alimenta las dos (p. ej. `RecetaPdf.tsx:496` y
`:511`).

**Instancia 1 — membrete.** `src/lib/pdf/PdfHeader.tsx`:

```
logoWrap (:52-62):  width/height = compact ? 52 : 62
                    borderRadius = logoBoxW / 2   → círculo
                    overflow: 'hidden'
                    borderWidth: 1.5, borderColor: '#d1d5db'
logo    (:63-67):   width: 80, height: 40, objectFit: 'contain'
```

**Los 8 formatos pasan `compact`** (`RecetaPdf.tsx:498`, `SolicitudLabPdf.tsx:235`,
`SolicitudImagenPdf.tsx:179`, `PlanSuplementacionPdf.tsx:264`,
`SolicitudInternamientoPdf.tsx:282` y `:440`,
`ConsentimientoInformadoPdf.tsx:596`, `:701`, `:731`, `:791`,
`EscritoMedicoPdf.tsx:470`, `NotaHonorariosPdf.tsx:305`), de modo que la caja es
siempre de **52×52** y la rama `62` es código muerto.

El desajuste es directo: **una imagen declarada de 80×40 dentro de un contenedor
circular de 52×52 con `overflow:'hidden'`.** El ancho declarado excede el
contenedor en 28 pt. `objectFit:'contain'` ajusta el contenido **dentro de la
caja de 80×40**, no dentro del círculo; el recorte lo hace el `overflow` del
padre. Para un PNG de 400×389 px (relación 1.03:1, prácticamente cuadrada),
`contain` sobre 80×40 produce un render de ~41×40 centrado en esa caja, y el
círculo de 52 de diámetro recorta las esquinas.

**Instancia 2 — marca de agua.** `src/lib/pdf/PdfWatermark.tsx:17-22`:

```
width: 220, height: 220, opacity: 0.05, transform: 'rotate(-25deg)'
```

**Sin `objectFit`.** Un PNG de 400×389 se estira a un cuadrado exacto de
220×220, deformándolo ~3 % horizontalmente. Con logos de proporción no cuadrada
(un membrete apaisado típico) la deformación es severa.

**Resumen del dimensionado:**

| Uso | Caja declarada | `objectFit` | Recorte | Deformación |
|---|---|---|---|---|
| Membrete | 80×40 dentro de círculo 52×52 | `contain` | Sí, por `overflow:'hidden'` del círculo | No (pero sí recorte) |
| Marca de agua | 220×220 | **Ninguno** | No | **Sí**, estirado a cuadrado |

**Coste:** la misma cadena Base64 se referencia dos veces por página y el
watermark va en `<View fixed>` (`PdfWatermark.tsx:29`), por lo que se repite en
todas las páginas del documento. **NO DETERMINADO:** si `@react-pdf/renderer`
deduplica el XObject de imagen en el PDF resultante cuando la fuente es la misma
data URL. Determinarlo requiere inspeccionar el diccionario `/XObject` del PDF
generado.

**Ubicaciones:** `src/lib/pdf/PdfHeader.tsx:52-67` (membrete),
`src/lib/pdf/PdfWatermark.tsx:17-22` (marca de agua),
`src/lib/mobileShare.ts:177-201` (resolución única de la fuente).

---

## Bloque 9 — Esquema de campos por formato

Columnas: **Obligatorio UI** = marcado con asterisco y/o bloquea el botón.
**Bloquea PDF** = su ausencia impide realmente generar el documento.
La discrepancia entre ambas columnas es el objeto de §9.9.

### 9.1 Receta — `RecetaForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha | `date` | No | No | `:411` |
| `paciente` | Nombre del paciente * | `text` | **Sí** | **Sí** | `:416`, botón `:542` |
| `diagnostico` | Diagnóstico | `text` | No | No | `:421` |
| `medicamentos[].nombre_comercial` | Nombre comercial | autocomplete | No | No | `:446-451` |
| `medicamentos[].presentacion` | Presentación | `text` | No | No | `:455` |
| `medicamentos[].via_administracion` | Vía de administración | `select` (12 opciones) | No (default `Oral`) | No | `:460-463` |
| `medicamentos[].principio_activo` | Principio activo | `text` | No | No | `:467` |
| `medicamentos[].indicacion` | Indicaciones de administración | `textarea` | No | No | `:472` |
| `recomendaciones` | Recomendaciones / Notas | `textarea` + `select` de 9 plantillas | No | No | `:507-531` |

Botón: `disabled={!paciente || imprimiendo}` (`:542`). Filtro previo al PDF:
`medicamentos.filter(m => m.nombre_comercial)` (`:288`) — **se puede emitir una
receta sin ningún medicamento**: si todas las filas quedan sin nombre comercial,
`medsData` es `[]` y la tabla se imprime con encabezado y cero filas.

### 9.2 Solicitud de Laboratorio — `SolicitudLabForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha | `date` | No | No | `:205` |
| `paciente` | Paciente * | `text` | **Sí** | **Sí** | `:207`, botón `:259` |
| `diagnostico` | Diagnóstico | `text` | No | No | `:209` |
| `estudios[]` | Estudios solicitados | autocomplete, lista | **Sí** (≥1 no vacío) | **Sí** | `:236-240`, botón `:259` |
| `notas` | Indicaciones / Notas | `textarea` | No | No | `:249` |
| — | Estudios frecuentes (10 presets) | toggles | No | No | `:217-222` |

Botón: `disabled={!paciente || estudios.filter(Boolean).length === 0 || imprimiendo}` (`:259`).

### 9.3 Solicitud de Imagen — `SolicitudImagenForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha | `date` | No | No | `:190` |
| `paciente` | Paciente * | `text` | **Sí** | **Sí** | `:192`, botón `:244` |
| `diagnostico` | Diagnóstico | `text` | No | No | `:194` |
| `urgente` | Marcar como URGENTE | `checkbox` | No | No | `:197` |
| `estudios[].tipo` | Tipo de estudio | `input`+`datalist` (8) | **Sí** (par con `region`) | **Sí** | `:212-216` |
| `estudios[].region` | Región anatómica | `text` | **Sí** (par con `tipo`) | **Sí** | `:220` |
| `estudios[].proyecciones` | Proyecciones | `text` | No | No | `:225` |
| `estudios[].indicacion` | Indicación clínica específica | `text` | No | No | `:230` |

Botón: `disabled={!paciente || estudios.filter(e => e.tipo && e.region).length === 0 || imprimiendo}` (`:244`).
El filtro exige **ambos** campos; un estudio con solo `tipo` se descarta silenciosamente del PDF (`:125`).

### 9.4 Solicitud de Internamiento — `SolicitudInternamientoForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha de solicitud | `date` | No | No | `:238` |
| `paciente` | Paciente * | `text` | **Sí** | **Sí** | `:242`, botón `:388` |
| `fechaIngreso` | Fecha propuesta de ingreso | `date` | No | No | `:246` |
| `tipoInternamiento` | Tipo de internamiento | `select` (5) | No | No | `:250-253` |
| `diasEstimados` | Días estimados de hospitalización | `text` | No | No | `:257` |
| `asa` | Clasificación ASA | `select` (6) | No | No | `:261-264` |
| `lugar` | Hospital / Lugar de internamiento * | `text` | **Sí** | **Sí** | `:271-277`, botón `:388` |
| `urgente` | Marcar como URGENTE | `checkbox` | No | No | `:280` |
| `diagnostico` | Diagnóstico principal * | `text` | **Sí** | **Sí** | `:293`, botón `:388` |
| `diagnosticosSecundarios[]` | Diagnósticos secundarios | `text`, lista | No | No | `:305` |
| `procedimiento` | Procedimiento / Cirugía solicitada | `textarea` | No | No | `:321` |
| `requerimientos[]` | Requerimientos especiales (7 chips) | toggles | No | No | `:331-338` |
| `requerimientosExtra` | Otro requerimiento | `text` | No | No | `:341` |
| `justificacion` | Justificación clínica | `textarea` | No | No | `:348` |
| `instruccionesPaciente` | Instrucciones para el paciente | `textarea` (pre-poblado, 6 líneas) | No | No | `:362`, default `:86-93` |
| `indicacionesPiso` | Indicaciones de ingreso a piso | `textarea` | No | No | `:375` — **decide si existe la página 2** (§8.3) |

Botón: `disabled={!paciente || !diagnostico || !lugar || imprimiendo}` (`:388`).
`requerimientos` y `requerimientosExtra` se fusionan solo para el PDF (`:168`);
en `contenido` van separados (`:125`).

### 9.5 Plan de Suplementación — `PlanSuplementacionForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha | `date` | No | No | `:395` |
| `paciente` | Paciente * | `text` | **Sí** | **Sí** | `:399`, botón `:532` |
| `diagnostico` | Diagnóstico | `text` | No | No | `:403` |
| `pesoKg` | Peso (kg) — calcula dosis por peso | `number` (20-300, paso 0.5) | No | No | `:409-416` |
| `seleccionados[]` | Suplementos (catálogo de 9) | toggles de tarjeta | **Sí** (≥1) | **Sí** | botón `:532` |
| `seleccionados[].dosis` | Dosis | `text` (autocalculado, editable) | No | No | `:474-476` |
| `seleccionados[].justificacion` | Nota / Justificación (opcional) | `text` | No | No | `:483-485` |
| `notas` | Notas adicionales | `textarea` | No | No | `:504` |
| `seguimiento` | Cita de control | `text` | No | No | `:514` |

Botón: `disabled={!paciente || seleccionados.length === 0 || imprimiendo}` (`:532`).

**Particularidad de persistencia:** es el único formato cuyo INSERT es
**condicional a `pacienteId`** (`:345-361`). Sin paciente asociado el PDF se
genera y se entrega pero **no queda registro en `documentos`** (`:363-367`
muestra "Plan generado" en vez de "Plan guardado").

### 9.6 Consentimiento Informado — `ConsentimientoInformadoForm.tsx`

**Datos de identificación:**

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `lugar` | Lugar * | `text` | **Sí** | **Sí** | `:300`, validación `:157` |
| `fecha` | Fecha * | `date` | **Sí** | **Sí** | `:304`, `:158` |
| `paciente` | Paciente * | `text` | **Sí** | **Sí** | `:308`, `:156` |
| `edad` | Edad del paciente * | `text` libre | **Sí** | **Sí** | `:312`, `:159` |
| `expediente` | No. Expediente | `text` | No | No | `:316` — **caja vacía**, §8.8 |
| `idPaciente` | Identificado con | `text` | No | No | `:320` — **caja vacía** |
| `procedimiento` | Procedimiento * | `text` | **Sí** | **Sí** | `:324`, `:160` |
| `diagnostico` | Diagnóstico * | `text` | **Sí** | **Sí** | `:328`, `:161` |
| `familiar` | Familiar responsable * | `text` | **Sí** | **Sí** | `:332`, `:162` |
| `idFamiliar` | Identificación del familiar | `text` | No | No | `:336` — **caja vacía** |
| `representante` | Representante legal (si aplica) | `text` | No | No | `:340` |
| `idRepresentante` | Identificación del representante | `text` | No | No | `:344` |
| `anestesiologo` | Médico anestesiólogo (si aplica) | `text` | No | No | `:348` |
| `testigo1` | Testigo 1 | `text` | No | No | `:352` |
| `testigo2` | Testigo 2 | `text` | No | No | `:356` |
| `autorizaTransfusion` | Autoriza transfusión de sangre | tri-estado `'si'\|'no'\|null` | No | No | `:365-378` |
| `autorizaFotos` | Autoriza uso de fotografías… | `checkbox` | No | No | `:384-391` |
| `imprimirDenegacion` | Incluir hoja de Denegación o Revocación | `checkbox` | No | No | `:412` — decide la página 4 |

**Secciones clínicas** (7 acordeones, `:397-405`), pre-pobladas desde
`SECCIONES_DEFAULT` (`:24-38`):

| Campo | Etiqueta | Default | Oblig. UI | Bloquea PDF |
|---|---|---|:-:|:-:|
| `secciones.preoperatorio` | 1 · Evaluación y decisión terapéutica | Texto largo | No | No |
| `secciones.beneficios` | 2 · Beneficios esperados | Texto largo | No | No |
| `secciones.anestesia` | 3 · Anestesia | Texto largo | No | No |
| `secciones.descripcion` | 4 · Descripción del procedimiento * | **Vacío** (`:31`) | **Sí** | **Sí** (`:162`) |
| `secciones.riesgosComunes` | 5 · Riesgos comunes | Texto largo | No | No |
| `secciones.riesgosEspecificos` | 6 · **Riesgos específicos** * | **Vacío** (`:35`) | **Sí** | **Sí** (`:163`) |
| `secciones.alternativas` | 7 · Alternativas de tratamiento | Texto largo | No | No |

**Verificación explícita de "Riesgos específicos" (solicitada):**

- Estado inicial **vacío**: `riesgosEspecificos: ''` (`:35`).
- Marcado con asterisco en la UI: `requerido={key === 'descripcion' || key === 'riesgosEspecificos'}` (`:403`), que pinta el `*` en `:69`.
- **Sí está en la validación bloqueante**: `{ val: secciones.riesgosEspecificos, label: 'Riesgos específicos' }` (`:163`), dentro del array que se filtra por `!c.val.trim()` (`:164`) y aborta con toast antes de `flushSync` (`:165-168`).
- La validación corre **en el cliente, antes de generar**, y el `return` temprano impide la emisión.

**Conclusión sobre Riesgos específicos: la protección existe y es efectiva.
No puede llegar vacío al PDF por la ruta de UI.** Es el campo mejor protegido
del formato, junto con "Descripción del procedimiento".

Es el único de los 8 formularios con validación explícita de campos
obligatorios (`:150-168`, 9 campos), justificada en el comentario como
requisito NOM-004-SSA3-2012. Su botón **no** lleva `disabled` por contenido
(`:429`: solo `disabled={imprimiendo}`) — la barrera es la validación, no el
botón.

### 9.7 Escrito Médico — `EscritoMedicoForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `fecha` | Fecha | `date` | No | No | `:318` |
| `paciente` | Paciente (opcional) | `text` | No | No | `:322` |
| `asunto` | Asunto / Tipo de documento | `text` | No | No | `:326` |
| cuerpo (editor) | — | TipTap WYSIWYG | **Sí** (no vacío) | **Sí** | `:370-373`, botón `:384` |

Botón: `disabled={isEmpty || imprimiendo}` (`:384`), con
`isEmpty = editor?.isEmpty ?? true` (`:130`). Doble guarda en `imprimir()`:
`if (!editor || editor.isEmpty) return` (`:149`) y
`if (!cuerpoSanitizado.trim()) return` (`:155`).

**Es el único formato que puede emitirse sin nombre de paciente** — el campo
está etiquetado explícitamente "(opcional)" y el renderer lo envuelve en
condicional (`EscritoMedicoPdf.tsx:490-495`).

Controles del editor (no son campos de datos): tipo de bloque (Normal / Título
principal / Título / Subtítulo, `:337-343`), negrita, itálica, subrayado
(`:347-349`), lista con viñetas, lista numerada (`:353-354`), 4 alineaciones
(`:358-361`), línea separadora y limpiar formato (`:365-366`).

### 9.8 Recibo de Honorarios / Cotización — `NotaHonorariosForm.tsx`

| Campo técnico | Etiqueta visible | Tipo | Oblig. UI | Bloquea PDF | Ref. |
|---|---|---|:-:|:-:|---|
| `tipoDoc` | Tipo de documento | 2 botones (`honorarios`/`cotizacion`) | No (default `honorarios`) | No | `:490-502` |
| `fecha` | Fecha | `date` (min 1900-01-01, max hoy+1 año) | No | No | `:512-518` |
| `paciente` | Paciente | `text` | **No** | **No** | `:523` |
| `folio` | Folio | `text` **readonly**, autogenerado | N/A | No | `:527` |
| `aseguradora` | Seguro de gastos médicos | toggle on/off | No | No | `:536-546` |
| `aseguradora.nombre` | Nombre de aseguradora | `text`+`datalist` (20) | No | No | `:553-560` |
| `aseguradora.poliza` | Número de póliza | `text` | No | No | `:586` |
| `aseguradora.cobertura` | Cobertura | `text` | No | No | `:596` |
| `lineas[].concepto` | Concepto * | `text` | **Sí** (≥1) | **Sí** | `:626-632` |
| `lineas[].precio` | Precio (divisa) * | `number` (min 0, paso 0.01) | **Sí** (>0) | **Sí** | `:635-644` |
| `formaPago` | Forma de pago | `select` (5) | No | No | `:685-687` — solo si no es cotización |
| `divisa` | Divisa | 2 botones MXN/USD | No (default MXN) | No | `:693-706` |
| `notas` | Notas y Consideraciones | `textarea` | No | No | `:715-721` |
| `templateName` | Nombre de la plantilla | `text` | Solo para guardar plantilla | No | `:754-762` |

Botón: `disabled={!puedeImprimir || imprimiendo}` (`:735`), con
`puedeImprimir = lineas.some(l => l.concepto.trim() !== '' && l.precio > 0) && !hayLineaInvalida` (`:147`).
`hayLineaInvalida` bloquea si hay concepto con precio ≤ 0 (`:146`), con mensaje
inline "El precio debe ser mayor a 0" (`:655`).

**Es el único formato de los 8 donde el paciente NO es obligatorio.** El PDF
imprime `{data.paciente || '—'}` (`NotaHonorariosPdf.tsx:334`) — nótese que aquí
sí se usa `||`, no `??`, así que el guion **sí** aparece con string vacío.

### 9.9 Campos obligatorios en la UI que pueden llegar vacíos al PDF

Análisis del hueco entre validación y render.

| Formato | Campo | Marcado `*` | ¿Puede llegar vacío? | Mecanismo |
|---|---|:-:|:-:|---|
| Consentimiento | `descripcion` (sección 4) | Sí | **No** | Validación bloqueante `:162` |
| Consentimiento | `riesgosEspecificos` (sección 6) | Sí | **No** | Validación bloqueante `:163` |
| Consentimiento | Los otros 7 obligatorios | Sí | **No** | Validación bloqueante `:154-168` |
| Receta | `paciente` | Sí | **No** | `disabled` en botón `:542` |
| Lab, Imagen, Suplementación, Internamiento | `paciente` | Sí | **No** | `disabled` en botón |
| Internamiento | `diagnostico`, `lugar` | Sí | **No** | `disabled` en botón `:388` |
| Lab | `estudios[]` | Sí | **No** | `disabled` en botón `:259` |
| Imagen | `estudios[]` | Sí | **No** | `disabled` en botón `:244` |
| Honorarios | `lineas[]` | Sí | **No** | `disabled` en botón `:735` |

**Resultado: no hay ningún campo marcado como obligatorio en la UI que pueda
llegar vacío al PDF.** Las dos barreras (validación explícita en Consentimiento;
`disabled` del botón en los otros 7) son efectivas en todas las rutas de UI.

**Sin embargo, hay tres rutas que eluden esas barreras por completo:**

1. **`ModalDocumentos.regenerarYSubirPdf`** (`:99-148`) pasa
   `doc.contenido` directo a `generarPdf` **sin validar nada**. Si un registro
   antiguo tiene campos que hoy son obligatorios, el PDF regenerado sale
   incompleto.
2. **`POST /api/generar-pdf`** (`route.ts:54-93`) acepta `data` arbitraria del
   body con la única comprobación de que `tipo` esté en `RENDERERS` (`:69-71`).
   **Sin Zod, sin validación de campos.** La ruta está muerta hoy (§7.2) pero es
   superficie abierta.
3. **Modo offline** — los formularios en `offlineMode` conservan las mismas
   validaciones de UI, pero el payload persiste en IndexedDB
   (`addDocument`, p. ej. `RecetaForm.tsx:354-364`) y **NO DETERMINADO** si el
   proceso de sincronización revalida. `src/lib/offline/sync.ts` existe pero no
   fue leído en esta auditoría; determinarlo requiere revisarlo.

**Riesgo transversal real, distinto del preguntado:** los campos **no**
obligatorios que se renderizan siempre (§8.8) producen documentos con cajas
etiquetadas y vacías. Ese es el hueco con impacto médico-legal, no el de los
obligatorios.

---

## Bloque 10 — Condicionales y multipágina

### 10.1 Qué lógica decide cuántas páginas tiene cada documento

**Dos modelos distintos coexisten:**

**Modelo A — flujo automático (6 de 8).** Receta, Lab, Imagen, Suplementación,
Escrito y Honorarios declaran **un solo `<Page>`** y dejan que react-pdf pagine
por desbordamiento. El header y el footer son `fixed`, de modo que se repiten en
las páginas que se generen. El número de páginas depende del volumen de datos y
**no está gobernado por ninguna condición del código**.

| Formato | Declaración | Línea |
|---|---|---|
| Receta | 1 `<Page>` | `:488` |
| Lab | 1 `<Page>` | `:224` |
| Imagen | 1 `<Page>` | `:168` |
| Suplementación | 1 `<Page>` | `:253` |
| Escrito | 1 `<Page>` | `:459` |
| Honorarios | 1 `<Page>` | `:294` |

**Modelo B — páginas explícitas (2 de 8).**

- **Internamiento** — `SolicitudInternamientoPdf.tsx`: página 1 fija (`:277`),
  página 2 condicional a `data.indicacionesPiso` truthy (`:435-475`).
  **1 o 2 páginas.**
- **Consentimiento** — `ConsentimientoInformadoPdf.tsx`: tres `<Page>` fijas
  (`:585`, `:691`, `:721`) más una cuarta condicional a `data.imprimirDenegacion`
  (`:780-837`). **3 o 4 páginas.**

  El reparto de contenido está **codificado por índice**, no por medida:
  ```ts
  const seccionesP1 = SECCION_LABELS.slice(0, 4)  // :258
  const seccionesP2 = SECCION_LABELS.slice(4)     // :259
  ```
  Las secciones 1-4 van a la página 1 y las 5-7 a la 2, **sin importar su
  longitud**. Como el médico puede escribir texto ilimitado en cualquiera de las
  7 (`ConsentimientoInformadoForm.tsx:77-82`, `textarea` sin `maxLength`), el
  reparto fijo puede producir una página 1 desbordada y una página 2 casi vacía,
  o al revés. Además cada `SeccionBlock` lleva `wrap={false}`
  (`ConsentimientoInformadoPdf.tsx:501`), lo que impide partir una sección larga
  entre páginas: si una sección no cabe en el espacio restante, salta entera a
  la página siguiente y deja hueco.

### 10.2 Bloques condicionales vs. bloques que se renderizan siempre

**Condicionales hoy:**

| Formato | Bloque | Condición | Línea |
|---|---|---|---|
| Receta | Recomendaciones (sección entera) | `data?.recomendaciones` | `:594` |
| Receta | QR de verificación | `data?.qrDataUrl` | `:610` |
| Receta | QR del blog | `data?.blogQrDataUrl` | `:616` |
| Receta | Presentación, principio activo del medicamento | truthy c/u | `:576`, `:579` |
| Lab | Notas / Indicaciones | `data.notas` | `:285` |
| Imagen | Badge URGENTE | `data.urgente` | `:201` |
| Suplementación | Peso | `data?.peso` | `:297` |
| Suplementación | Diagnóstico | `data?.diagnostico` | `:303` |
| Suplementación | Justificación por suplemento | `sup?.justificacion` | `:340` |
| Suplementación | Notas | `data?.notas` | `:354` |
| Suplementación | Cita de control | `data?.citaControl` | `:366` |
| Suplementación | QR del blog | `data?.blogQrDataUrl` | `:377` |
| Internamiento | Badge URGENTE | `data.urgente` | `:300` |
| Internamiento | Fecha de ingreso | `data.fechaIngreso` | `:316` |
| Internamiento | Hospital / Lugar | `data.lugar` | `:325` |
| Internamiento | Tipo, Días, ASA | truthy c/u | `:336`, `:342`, `:348` |
| Internamiento | Procedimiento | `data.procedimiento` | `:371` |
| Internamiento | Requerimientos | `.length > 0` | `:381` |
| Internamiento | Justificación clínica | `data.justificacion` | `:397` |
| Internamiento | Instrucciones para el paciente | `data.instruccionesPaciente` | `:407` |
| Internamiento | **Página 2 completa** | `data.indicacionesPiso` | `:435` |
| Consentimiento | Representante legal (2 celdas) | `data?.representante` | `:665` |
| Consentimiento | Línea de transfusión | `data.autorizaTransfusion != null` | `:768` |
| Consentimiento | Línea de fotografías | `data.autorizaFotos` | `:769` |
| Consentimiento | **Página 4 (denegación)** | `data.imprimirDenegacion` | `:780` |
| Escrito | Paciente | `data.paciente` | `:490` |
| Escrito | Banner de asunto | `data.asunto` | `:499` |
| Honorarios | Bloque aseguradora | `data.aseguradora?.nombre` | `:339` |
| Honorarios | Póliza, Cobertura | truthy c/u | `:345`, `:351` |
| Honorarios | Forma de pago | `!esCotizacion && data.formaPago` | `:382` |
| Honorarios | Notas | `data.notas` | `:390` |
| `PdfHeader` | Especialidad, cédulas, extraCredencial, contacto, folio | truthy c/u | `:143`, `:145`, `:151`, `:158`, `:163`, `:168`/`:170` |
| `PdfFirma` | Imagen de firma, cédulas | truthy c/u | `:65`, `:75`, `:76` |
| `PdfWatermark` | Todo el componente | `if (!logoUrl) return null` | `:26` |
| `PdfBarras` | Línea de contacto | `contactoParts` no vacío | `:59` |

**Se renderizan SIEMPRE aunque no apliquen:**

| Formato | Bloque | Consecuencia |
|---|---|---|
| Lab | Caja `DIAGNÓSTICO` | Caja vacía si no hay dx (§8.8) — `:266-269` |
| Lab | Segunda columna de la tabla | Header huérfano con nº impar de estudios (§8.2) — `:281` |
| Imagen | Caja `DIAGNÓSTICO` | Caja vacía — `:219-222` |
| Consentimiento | `NO. EXPEDIENTE`, `IDENTIFICACIÓN PACIENTE`, `IDENTIFICACIÓN FAMILIAR` | 3 cajas vacías (§8.8) — `:641`, `:653`, `:661` |
| Consentimiento | **Los 6 recuadros de firma** | Ver §10.3 |
| Consentimiento | Las 7 secciones clínicas | Si el médico vacía una sección no obligatoria, se imprime su header numerado con cuerpo vacío — `:685-687`, `:715-717`, `:498-511` |
| Receta | Tabla de medicamentos (header) | Header sin filas si no hay medicamentos con nombre (§9.1) — `:550-563` |
| Receta | Cajas `EDAD`, `SEXO`, `DIAGNÓSTICO` | Muestran `'—'` correctamente (contrato respetado) — `:522-540` |
| Los 8 | Marca de agua | Siempre presente (§2.6) |
| Los 8 | Banda de footer con branding Spinus | Siempre presente — `PdfBarras.tsx:60` |

### 10.3 Bloque de firmas del Consentimiento — ¿anestesiólogo y testigos son condicionales o fijos?

**Son FIJOS. Los seis recuadros se imprimen siempre.**

`ConsentimientoInformadoPdf.tsx:514-556` (`FirmasBlock`) monta seis `<FirmaBox>`
**sin una sola condición**:

```tsx
<FirmaBox label="Paciente"           nombre={data?.paciente ?? ''} idLabel="Identificación" idVal={data?.idPaciente} .../>  // :517-523
<FirmaBox label="Médico Tratante"    nombre={nombre} sublabel={medico?.especialidad} idLabel="Céd. Prof." idVal={cedProf} .../>  // :524-531
<FirmaBox label={data?.representante ? 'Representante Legal' : 'Familiar / Responsable'} .../>  // :532-538
<FirmaBox label="Anestesiólogo"      nombre={data?.anestesiologo} .../>  // :539-543
<FirmaBox label="Testigo 1"          nombre={data?.testigo1} .../>       // :544-548
<FirmaBox label="Testigo 2"          nombre={data?.testigo2} .../>       // :549-553
```

El **único** condicional del bloque es cosmético: la etiqueta del tercer recuadro
alterna entre "Representante Legal" y "Familiar / Responsable" según
`data?.representante` (`:533`). El recuadro se dibuja en ambos casos.

Dentro de `FirmaBox` (`:126-140`) sí hay condicionales, pero solo sobre las
líneas de texto **interiores**:

```tsx
<View style={fb.wrap}>
  <View style={fb.space} />        {/* :128 — 48 pt de aire, SIEMPRE */}
  <View style={fb.line}>           {/* :129 — línea de firma, SIEMPRE */}
    <Text style={fb.label}>{label}</Text>              {/* :130 — SIEMPRE */}
    {nombre ? <Text ...>{nombre}</Text> : null}        {/* :131 */}
    {sublabel ? <Text ...>{sublabel}</Text> : null}    {/* :132 */}
    {idLabel && idVal ? <Text ...>…</Text> : null}     {/* :133-137 */}
  </View>
</View>
```

Es decir: con `anestesiologo`, `testigo1` y `testigo2` vacíos —el caso normal,
son campos opcionales (`ConsentimientoInformadoForm.tsx:348`, `:352`, `:356`)—
el documento imprime **tres recuadros de firma con línea y etiqueta, sin nombre
debajo**. Cada uno ocupa 48 pt de espacio en blanco + línea + etiqueta +
`marginBottom: 24` (`:91-95`) ≈ 90 pt, en un ancho del 48 % (`:91`).

Esos tres recuadros vacíos consumen una fila completa de la rejilla de la página
3 y contribuyen directamente al desbordamiento contra la banda del footer
descrito en §8.1.

La página 4 (denegación) repite el mismo `FirmasBlock` completo (`:835`) —
incluidos anestesiólogo y testigos, que en una hoja de revocación son aún menos
pertinentes.

### 10.4 Manejo del desborde de texto largo

**No hay ninguna estrategia común. Cada formato hace algo distinto, y tres no
hacen nada.**

| Formato | Mecanismo | Ubicación | Comportamiento con texto largo |
|---|---|---|---|
| Receta | `wrap={false}` por fila de medicamento | `:569` | Una fila no se parte entre páginas. Si una sola fila excede una página entera, **NO DETERMINADO** si react-pdf la parte igualmente o la desborda |
| Receta | `wrap={false}` en el bloque QR+firma | `:608` | El pie no se parte |
| Suplementación | `wrap={false}` por suplemento (fila + justificación) | `:327` | Idéntico a Receta |
| Honorarios | `wrap={false}` por línea de concepto | `:367` | Idéntico |
| Internamiento | `wrap={false}` en el bloque de firmas de la pág. 1 | `:417` | La firma no se parte. **La pág. 2 no lo lleva** (`:463`) |
| Consentimiento | `wrap={false}` por sección clínica | `:501` | Una sección entera salta de página si no cabe. Con secciones muy largas deja huecos grandes |
| **Lab** | **Ninguno** | — | Filas y notas fluyen libres. `notasBox` (`:190-195`) sin límite |
| **Imagen** | **Ninguno** | — | Filas de la tabla fluyen libres |
| **Escrito** | **Ninguno** | — | Todo el cuerpo fluye. Es el formato con texto más variable |

**Nada de esto está acotado en la entrada.** Ninguno de los 8 formularios impone
`maxLength` a sus `textarea`: verificado en `RecetaForm.tsx:525-531`
(recomendaciones), `SolicitudLabForm.tsx:249-250` (notas),
`SolicitudInternamientoForm.tsx:348-350`, `:362-363`, `:375-377`,
`ConsentimientoInformadoForm.tsx:77-82` (las 7 secciones),
`PlanSuplementacionForm.tsx` (notas), `NotaHonorariosForm.tsx:715-721`.
La única cota de longitud del sistema está en un lugar no relacionado:
`MAX_DESCRIPCION = 200` en `src/components/labs/ModalSubirDocumento.tsx:18`.

**Casos concretos sin protección:**

- **Escrito Médico** — el editor TipTap no tiene límite. Un escrito de 10
  páginas se pagina automáticamente, pero como el bloque `<PdfFirma>` va
  **fuera** del `<View style={{flex:1}}>` (`EscritoMedicoPdf.tsx:510-513`), la
  firma cae al final del flujo. **NO DETERMINADO** si en documentos multipágina
  queda en la última página correctamente o si el `flex:1` la desplaza; requiere
  generar un escrito largo y observarlo.
- **Consentimiento** — texto largo en la sección 4 (obligatoria, en la página 1
  junto con las secciones 1-3) puede empujar el contenido más allá de la página
  mientras la página 2 (secciones 5-7) queda semivacía, por el reparto fijo de
  `:258-259`.
- **Internamiento** — `indicacionesPiso` se imprime como un único `<Text>`
  (`:458`) sin `wrap={false}` ni límite; un texto de 3 páginas genera 3 páginas
  y el bloque de firma queda al final, con el problema de `marginTop: 60` de
  §8.1 en la última.
- **Lab** — `notasBox` (`:290-292`) es un `<View>` con un `<Text>` dentro, sin
  `wrap` controlado: puede partirse a mitad de la caja, dejando el borde abierto
  entre páginas.

---

## Bloque 11 — QR y sistema de verificación

Implementación completa, distribuida en cuatro archivos:
`src/components/documentos/RecetaForm.tsx` (generación del folio y del QR),
`src/lib/pdf/RecetaPdf.tsx` (impresión), `src/app/r/[folio]/page.tsx` (página
pública) y `src/app/api/r/[folio]/route.ts` (endpoint JSON).

### 11.1 Contenido del QR — carga literal

**Es una URL en texto plano. Nada más.**

`src/components/documentos/RecetaForm.tsx:271-277`:

```ts
const verificacionUrl = `${window.location.origin}/r/${folio}`
const [qrDataUrl, blogQrDataUrl] = await Promise.all([
  QRCode.toDataURL(verificacionUrl, {
    width: 96,
    margin: 1,
    color: { dark: '#1a3a5c', light: '#ffffff' },
  }),
  ...
])
```

Carga literal codificada: **`https://<origen>/r/R-08240bf7f996`**.

- **No** es un JWT ni un token firmado.
- **No** contiene datos del paciente, ni del médico, ni clínicos.
- **No** lleva firma ni checksum.
- El color oscuro del QR está **hardcodeado a `#1a3a5c`** (`:276`), no usa la
  paleta del médico — inconsistente con el resto del documento, y con el segundo
  QR del mismo archivo, que sí la usa (`:282`).

**Segundo QR (no es de verificación):** solo para super-admin
(`isSuperAdmin`, `:278`), codifica la URL fija
`https://dranconacolumna.com/articulos.html` (`:279`) con etiqueta "Blog del
especialista" (`RecetaPdf.tsx:619`). El Plan de Suplementación tiene otro
equivalente con un ancla distinta (`PlanSuplementacionForm.tsx:262-265`).

### 11.2 Generación del folio — código exacto

`src/components/documentos/RecetaForm.tsx:246`:

```ts
const folio = `R-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
```

**Es aleatorio criptográfico, no derivado.** `crypto.randomUUID()` es UUID v4 de
la Web Crypto API. Se eliminan los guiones y se toman los **primeros 12
caracteres hexadecimales**.

Consecuencias de ese recorte:

- Los 12 primeros caracteres de un UUID v4 son `time_low` (8) + `time_mid` (4),
  ambos **completamente aleatorios** en la v4. No hay componente temporal ni
  contador.
- Espacio de claves: 16^12 = **2^48 ≈ 2.8 × 10^14** valores.
- **No es enumerable en sentido secuencial** (no hay orden ni incremento).
- Sí es **adivinable por fuerza bruta** en términos absolutos: 2^48 es un espacio
  moderado. El límite práctico lo pone el rate limiting, que solo cubre uno de
  los dos caminos (§11.8).
- No hay comprobación de colisión previa al insert; la garantía la da el índice
  UNIQUE parcial `idx_documentos_client_id`
  (`supabase/baseline/03_indexes.sql:84-85`), ya que `client_id = folio`
  (`:374`). Una colisión produciría un error de insert **después** de haber
  generado y entregado el PDF (`:381-382`), dejando un PDF sin registro.

**Comparación con el folio de Honorarios** — `NotaHonorariosForm.tsx:40-46`:

```ts
function generarFolio(tipo: TipoDoc = 'honorarios'): string {
  const now = new Date()
  const ymd = format(now, 'yyyyMMdd')
  const seq = String(now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()).padStart(5,'0')
  const prefix = tipo === 'cotizacion' ? 'COT' : 'NOH'
  return `${prefix}-${ymd}-${seq}`
}
```

Ese sí es **totalmente derivado y enumerable**: fecha + segundo del día. Dos
documentos emitidos en el mismo segundo obtienen el mismo folio, y cualquiera
puede enumerar los 86 400 folios posibles de un día. No tiene página de
verificación asociada, así que hoy no es explotable — **pero si el QR se
extiende a los 8 formatos tal cual, Honorarios quedaría con folios enumerables
apuntando a una página pública.**

### 11.3 ¿Folio y llave de acceso son el mismo valor?

**Son el mismo valor.** No hay dos campos.

- El folio se imprime visible en el PDF: `PdfHeader.tsx:168`
  (`<Text style={s.rxFolio}>{folio}</Text>`, bajo el símbolo "Rx"), alimentado
  desde `RecetaPdf.tsx:497`.
- El mismo string es el segmento de la URL del QR (`RecetaForm.tsx:271`).
- El mismo string es la clave de búsqueda del endpoint y de la página
  (`api/r/[folio]/route.ts:18`, `r/[folio]/page.tsx:40`):
  `.filter('contenido->>folio', 'eq', folio)`.
- El mismo string es `client_id` en la tabla (`RecetaForm.tsx:374`), con el
  comentario que lo declara doble propósito (`:242-245`).

**Implicación directa:** quien vea el papel de la receta —o una foto de él— tiene
la llave completa de acceso a la página pública. No hace falta escanear el QR ni
tener el PDF: basta con teclear los 14 caracteres. No existe secreto separado.

### 11.4 Endpoint de verificación

Hay **dos** superficies públicas para el mismo folio:

**(a) Página RSC — `src/app/r/[folio]/page.tsx`**

- Ruta: `GET /r/[folio]`.
- **Pública, sin autenticación.** `src/middleware.ts:58` la exceptúa
  explícitamente: `|| pathname.startsWith('/r/')` dentro de `isPublicPage`.
- Usa `createAdminClient()` (`:35`) — **service role, bypass de RLS total**.
- Query (`:36-41`): `.from('documentos').select('contenido, created_at')
  .eq('tipo','receta').filter('contenido->>folio','eq',folio).single()`.
- Si no encuentra, `notFound()` (`:43`).

**(b) API JSON — `src/app/api/r/[folio]/route.ts`**

- Ruta: `GET /api/r/[folio]`.
- Pública (mismo bypass de middleware).
- Mismo `createAdminClient()` y misma query (`:13-19`).
- Devuelve **`{ receta: data.contenido, emitida: data.created_at }`** (`:23`) —
  es decir, **el objeto `contenido` COMPLETO, sin filtrar campo alguno**.

**Campo por campo, lo que ve quien escanea (página HTML):**

| Elemento | Contenido | Línea | ¿Clínico o PII? |
|---|---|---|---|
| Sello "Receta Verificada" | Texto fijo | `:74` | — |
| Fecha y hora de emisión | `created_at` con hora y minuto en la TZ del emisor | `:56-60`, `:76` | Metadato |
| Folio | `receta.folio` | `:76` | Identificador |
| **Nombre del médico** | `medico_nombre` | `:85` | PII del médico |
| Especialidad | `medico_especialidad` | `:86` | — |
| Nombre de la clínica | `clinica_nombre` | `:87` | — |
| **Cédula profesional** | `medico_cedula_profesional` | `:91` | PII del médico |
| **Cédula de especialidad** | `medico_cedula_especialidad` | `:94` | PII del médico |
| **NOMBRE COMPLETO DEL PACIENTE** | `receta.paciente` | `:104` | **PII sensible** |
| Fecha de la receta | `receta.fecha` formateada | `:108` | — |
| **DIAGNÓSTICO** | `receta.diagnostico` | `:113` | **Dato de salud** |
| **MEDICAMENTOS** — nombre comercial | `m.nombre_comercial` | `:136` | **Dato de salud** |
| Presentación | `m.presentacion` | `:137` | **Dato de salud** |
| Principio activo | `m.principio_activo` | `:139` | **Dato de salud** |
| Vía de administración | `m.via_administracion` | `:142` | **Dato de salud** |
| Indicación / posología | `m.indicacion` | `:145` | **Dato de salud** |
| **RECOMENDACIONES** | `receta.recomendaciones` (texto libre completo) | `:156` | **Dato de salud** |
| Colores de marca | `color_primario`, `color_secundario` | `:47-48` | — |

**Respuesta explícita a la pregunta: sí, incluye contenido clínico completo
(diagnóstico, medicamentos con posología y recomendaciones) y sí, incluye el
nombre completo del paciente**, en una página sin autenticación cuya llave es el
folio impreso en el papel.

El endpoint JSON expone además todo lo que el HTML no pinta pero está en
`contenido`: `timezone` del dispositivo emisor y cualquier campo futuro que se
añada al payload, porque devuelve el objeto entero (`route.ts:23`).

### 11.5 Cabeceras HTTP de esa ruta

Las cabeceras se aplican globalmente en `next.config.ts:28-35`, con
`source: '/(.*)'` — no hay bloque específico para `/r/`.

| Cabecera | ¿Existe? | Valor | Ref. |
|---|:-:|---|---|
| `X-Robots-Tag` | **NO** | — | Ausente en `securityHeaders` (`:4-10`) |
| `Referrer-Policy` | **Sí** | `strict-origin-when-cross-origin` | `next.config.ts:8` |
| `Cache-Control` | **NO configurada** | Queda el default de Next.js / Vercel | Ausente en `:4-10` |
| `X-Content-Type-Options` | Sí | `nosniff` | `:5` |
| `X-Frame-Options` | Sí | `DENY` | `:6` |
| `X-XSS-Protection` | Sí | `1; mode=block` | `:7` |
| `Permissions-Policy` | Sí | `camera=(), microphone=(), geolocation=()` | `:9` |

Sobre `Referrer-Policy`: `strict-origin-when-cross-origin` envía **solo el
origen** al navegar a otro dominio, de modo que el folio no se filtra por
Referer hacia fuera. Es correcto para este caso.

Sobre `Cache-Control`: **NO DETERMINADO** cuál es el valor efectivo en
producción. La página es un RSC dinámico (usa `params` y consulta la DB en cada
request), lo que normalmente fuerza `no-store` en Next.js, pero no está
declarado explícitamente ni hay `export const dynamic`. Verificarlo requiere un
`curl -I` contra el despliegue.

### 11.6 Meta tags robots y Open Graph

**No hay meta tags robots.** `src/app/r/[folio]/page.tsx` **no exporta
`metadata` ni `generateMetadata`** — el archivo empieza en `notFound` /
`createAdminClient` (`:1-5`) y termina en el JSX (`:167`). Búsqueda de
`metadata`, `robots`, `openGraph` en el archivo: sin resultados.

Hereda entonces la metadata del layout raíz — `src/app/layout.tsx:4-7`:

```ts
export const metadata: Metadata = {
  title: 'Spinus®',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
}
```

**No hay `robots` ahí tampoco** (`:4-7`), ni en ningún `layout.tsx` del árbol
que cubra `/r/` (la ruta vive en `src/app/r/`, fuera de los route groups
`(app)`, `(landing)`, `(launcher)`, `(offline)`).

**Open Graph: no existe ninguna etiqueta OG en la ruta ni en el layout raíz.**
Búsqueda de `openGraph` en `src/app/**/layout.tsx`: solo aparece en
`src/app/(landing)/layout.tsx` (`:32`), que **no** cubre `/r/`.

Respuesta a lo preguntado: **la vista previa de WhatsApp o redes NO expone datos
del paciente**, porque no hay OG que los inyecte. Lo que se muestra al pegar el
enlace es el título genérico `Spinus®` y la descripción del layout raíz.

**Matiz importante:** eso protege la *vista previa*, no el contenido. Cualquiera
con el enlace que lo abra ve la receta completa. Y varios servicios de mensajería
hacen fetch del enlace para generar la previsualización, lo que significa que el
contenido clínico **sí se solicita** al servidor desde infraestructura de
terceros, aunque no se renderice en la tarjeta.

### 11.7 ¿La ruta aparece en sitemap.xml o robots.txt?

**No existe ninguno de los dos archivos en el proyecto.** Búsqueda en `src/` y
`public/` de `robots.ts`, `robots.txt`, `sitemap.ts`, `sitemap.xml`: **cero
resultados**.

Consecuencia: no hay `Disallow` que impida el rastreo de `/r/`, y tampoco hay
sitemap que la publique activamente. La ruta queda expuesta al rastreo si algún
enlace la referencia desde fuera (un correo reenviado, una captura compartida,
un servicio de acortado). Sin `X-Robots-Tag` (§11.5) ni meta robots (§11.6), **no
hay ninguna señal de no-indexación en toda la cadena.**

### 11.8 Rate limiting

**Existe en el endpoint JSON, NO existe en la página HTML.**

`src/app/api/r/[folio]/route.ts:6-8`:

```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const limited = await checkIpRateLimit(ip, 'verificar-receta', 30)
if (limited) return limited
```

`checkIpRateLimit` (`src/lib/rateLimit.ts:111-147`) cuenta inserciones en
`ip_rate_limits` en la última hora y devuelve 429 al superar el límite. **30
peticiones por hora por IP.**

`src/app/r/[folio]/page.tsx` **no llama a `checkIpRateLimit` ni a ninguna otra
protección**. El archivo entero (`:1-167`) no importa `@/lib/rateLimit`. La
página consulta la base con service role directamente en `:36-41`, sin límite.

**Consecuencia:** el rate limiting es eludible sin esfuerzo — basta con enumerar
contra `/r/{folio}` en lugar de `/api/r/{folio}`. Ambos devuelven el mismo dato;
solo uno está protegido. Además, el fallback `?? 'unknown'` (`route.ts:6`) hace
que todas las peticiones sin `x-forwarded-for` compartan un único cubo llamado
`'unknown'`.

### 11.9 Caducidad, revocación, estado del enlace y registro de accesos

**Ninguno de los cuatro existe.**

| Mecanismo | Estado | Evidencia |
|---|---|---|
| Caducidad | **No existe** | La query (`page.tsx:36-41`, `route.ts:14-20`) no filtra por fecha. Un folio funciona indefinidamente |
| Revocación | **No existe** | No hay columna de estado ni campo `revocado` en `documentos` (`supabase/baseline/02_tables.sql:207-234`) ni en `contenido` |
| Estado del enlace | **No existe** | No hay máquina de estados. El enlace vive mientras exista la fila |
| Registro de accesos | **No existe** | Ni la página ni el endpoint llaman a `logAudit` |

Sobre el registro de accesos, el hallazgo es más concreto: **la acción de
auditoría `'verificar_receta'` está declarada en el catálogo de tipos**
(`src/lib/audit.ts:26`, dentro de `AuditAccion`, en el grupo "Operaciones sobre
documentos") y el encabezado del módulo la anuncia explícitamente entre lo que
el sistema registra (`:10`: *"Generación de PDFs, envío de emails, verificación
de recetas"*). **Búsqueda de `verificar_receta` en todo `src/` fuera de
`audit.ts`: cero resultados.** Es una acción declarada que nunca se emite.

Efecto lateral: como la eliminación del documento es un hard delete
(`api/documentos/[id]/route.ts:23`), **borrar la receta es hoy la única forma de
invalidar su enlace público** — y eso también borra el registro clínico y el PDF
de Storage (`:32-38`).

### 11.10 ¿Se almacena un hash del PDF?

**No.** Confirmado en tres niveles:

- **Esquema:** `documentos` no tiene columna de hash, checksum ni firma
  (`supabase/baseline/02_tables.sql:207-234`). Las 15 columnas son `id`,
  `paciente_id`, `consulta_id`, `tipo`, `contenido`, `pdf_url`, `created_at`,
  `client_id`, `storage_bucket`, `storage_path`, `mime_type`, `tamaño_bytes`,
  `nombre_original`, `subido_por`.
- **Pipeline:** `src/lib/mobileShare.ts` no calcula digest en ninguna de sus 6
  fases (`:172-262`). El blob se sube tal cual (`:230-235`).
- **Formularios:** ninguno de los 8 inserta un campo de hash.

Consecuencia para la verificación: la página `/r/[folio]` **verifica el registro
en base de datos, no el papel que tiene el paciente en la mano**. Confirma que
existe una receta con ese folio y muestra su contenido, pero no puede detectar
que el PDF impreso haya sido alterado, ni que el `contenido` en DB haya
divergido del PDF almacenado. `contenido` es una columna `jsonb` actualizable, y
**no hay trigger de inmutabilidad sobre `documentos`** (verificado en
`supabase/baseline/06_triggers.sql`: los triggers de esa tabla no incluyen guarda
de inmutabilidad; `supabase_migration_audit_immutable.sql` protege `audit_log`,
no `documentos`).

### 11.11 ¿Cuántos documentos con QR existen ya emitidos en producción?

**NO DETERMINADO.** No tengo acceso a la base de datos de producción y las
reglas del proyecto prohíben ejecutarla.

El conteo se obtiene con:

```sql
SELECT count(*) FROM public.documentos
WHERE tipo = 'receta' AND contenido ? 'folio';
```

Dato indirecto disponible: la migración
`supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql:45-49`
registra que al 2026-06-03 el bucket `documentos-pdf` contenía **222
documentos** en total (207 accesibles + 15 huérfanos), de los 8 formatos
sumados. Ese número es un techo, no el conteo de recetas, y tiene ya dos meses.

---

## Bloque 12 — Envío de documentos y captura de firma

### 12.1 Sistema de envío por correo

**Proveedor: Resend.** `src/app/api/email/enviar-documento/route.ts:3` y `:10`
(`const resend = new Resend(process.env.RESEND_API_KEY)`).

- Ruta única: `POST /api/email/enviar-documento`. Es el único endpoint bajo
  `src/app/api/email/`.
- Remitente: `'Spinus <noreply@mail.spinus.com.mx>'` (`:119`).
- Disparador en UI: `ModalVisorDocumento.tsx:56-82` (`enviarAlPaciente`), botón
  "Enviar al paciente" (`:119-133`). Solo aparece si el paciente tiene email
  registrado (`:84`).

**Plantilla:** no hay sistema de plantillas ni proveedor externo de templates.
El HTML se construye en línea con template literals dentro del mismo archivo —
función `generarHtmlEmail` (`:144-305`).

**Asunto** — `:121`:

```
`${tipoLabel} — ${medicoNombre}`
```

donde `tipoLabel` sale del mapa `TIPO_LABEL` (`:12-22`): "Receta médica",
"Solicitud de laboratorio", "Solicitud de imagen", "Plan de suplementación",
"Informe clínico", "Escrito médico", "Solicitud de internamiento",
"Consentimiento informado", "Recibo de honorarios".

**El asunto sí revela el tipo de documento clínico** (p. ej. *"Receta médica —
Dr. Juan Pérez"*), visible en la bandeja de entrada, en notificaciones de
bloqueo de pantalla y en cualquier previsualización. No incluye nombre de
paciente ni diagnóstico.

**Cuerpo — transcripción de la estructura** (`:268-304`):

```
┌─ Cabecera azul (#1a3a5c) ─────────────────────────┐
│  SPINUS                                           │  :281
│  {tipoLabel}                    (h1, 22px)        │  :282
├─ Cuerpo blanco ───────────────────────────────────┤
│  Emitido por                                      │  :287
│  {medicoNombre}                                   │  :290
│  Paciente                       (si existe)       │  :292
│  {contenido.paciente}                             │  :293
│  {cuerpo}   ← bloque específico por tipo          │  :295
│  "Documento generado el {fecha}. Este mensaje     │  :296-298
│   fue enviado desde el sistema de gestión         │
│   clínica Spinus."                                │
└───────────────────────────────────────────────────┘
```

**Contenido clínico por tipo, en el cuerpo del mensaje:**

| Tipo | Qué se transcribe | Líneas |
|---|---|---|
| Receta | Tabla con **cada medicamento**: número, nombre comercial en mayúsculas, presentación, principio activo, indicación completa. Más el bloque **Recomendaciones** íntegro | `:152-170` |
| Solicitud lab | Lista completa de estudios + notas | `:171-178` |
| Solicitud imagen | Lista de estudios: tipo, región, proyecciones, indicación | `:179-186` |
| Plan suplementación | Lista de suplementos con dosis y justificación + notas | `:187-200` |
| Escrito médico | Asunto + **cuerpo completo del escrito**, renderizado desde el JSON de TipTap con `generateHTML` (`:210`) o el HTML legacy (`:211`) | `:201-216` |
| Consentimiento | Procedimiento, familiar/representante, anestesiólogo + aviso | `:217-228` |
| Internamiento | Hospital, motivo, tipo | `:229-237` |
| Honorarios | Folio, tabla de conceptos con precios, total, forma de pago | `:238-266` |

**Respuesta explícita: sí, el correo incluye datos clínicos completos en el
cuerpo** — medicamentos con posología, diagnóstico implícito en el contenido,
estudios solicitados, el texto íntegro del escrito médico. El asunto revela el
tipo de documento pero no el contenido.

**Defecto de correspondencia en Internamiento** (`:231-233`): el bloque lee
`contenido.hospital`, `contenido.motivo` y `contenido.tipo_internamiento`,
pero `SolicitudInternamientoForm.tsx:122-125` guarda `lugar`, `justificacion` y
`tipoInternamiento`. **Las tres claves no coinciden: el bloque siempre queda
vacío** y el correo de internamiento sale sin ningún dato del documento.

**Sanitización:** ninguna. Todos los valores se interpolan directo en el HTML
(p. ej. `${m.nombre_comercial.toUpperCase()}` en `:158`,
`${contenido.recomendaciones}` en `:168`, `${contenido.asunto}` en `:205`). No
hay `escapeHtml` ni DOMPurify en la ruta. El contenido lo escribe un médico
autenticado, de modo que el vector es limitado, pero el `cuerpoHtml` del escrito
médico (`:209-211`) se inyecta sin pasar por `sanitizeEditorHtml` — la
sanitización solo ocurre en el formulario, y solo sobre el campo `cuerpo`, no
sobre el `doc` JSON que aquí se re-renderiza.

### 12.2 ¿Se adjunta el PDF, se envía un enlace, o solo información en el cuerpo?

**Solo información en el cuerpo. No hay adjunto ni enlace.**

- La llamada a Resend (`:118-123`) pasa únicamente `from`, `to`, `subject`,
  `html`. **No hay propiedad `attachments`.**
- El código nunca lee `doc.pdf_url` ni genera signed URL: el SELECT del
  documento pide `id, tipo, contenido, created_at, paciente_id` (`:68`) —
  **`pdf_url` ni siquiera se trae**.
- El HTML no contiene ninguna etiqueta `<a href>` (verificado sobre `:144-305`).

El paciente recibe una transcripción HTML del contenido clínico, no el
documento. El PDF con membrete, firma, folio y QR **no viaja por correo en
ningún caso**.

### 12.3 Enlaces caducables, revocables o autenticados

**No aplica: no se envían enlaces** (§12.2). El único enlace público del sistema
es el QR de la receta, que no se envía por correo y cuyas propiedades están
documentadas en §11.9 (sin caducidad, sin revocación, sin autenticación).

### 12.4 Registro de envíos

**Sí existe, en `audit_log`, vía `logAudit`.**

| Evento | Acción registrada | Datos guardados | Línea |
|---|---|---|---|
| Envío exitoso | `'enviar_documento'` | `userId`, `tabla:'documentos'`, `registroId: documentoId`, `ip`, `descripcion: "${tipoLabel} enviado a ${pacienteEmail}"` | `:128-135` |
| Envío denegado por email no coincidente | `'enviar_documento_denegado'` | Ídem + descripción con el email solicitado y la nota de que requiere confirmación | `:87-94` |

**Sí se guarda a qué dirección se envió cada documento**, dentro del campo
`descripcion` en texto libre (`:134`). No hay columna estructurada de
destinatario; para consultar "todos los envíos a X" hay que hacer búsqueda de
texto sobre `descripcion`.

**Control de destinatario** (`:74-100`): antes de enviar, compara el email
solicitado contra `pacientes.email` del `paciente_id` del documento
(`:76-83`). Si difieren y el médico no confirmó, devuelve `403` con
`{ error: 'email_mismatch', emailRegistrado }` (`:95-98`) y registra el intento.
La UI muestra un panel de confirmación con ambos emails
(`ModalVisorDocumento.tsx:89-111`) y reintenta con
`confirmarEmailAlterno: true`. El comentario de cabecera (`:24-27`) declara la
medida como cumplimiento LFPDPPP.

**Rate limiting:** 10 emails por hora por usuario (`:46-60`), contando filas de
`rate_limits` con `ruta = 'enviar-documento'` en la última hora, con inserción
del registro antes de enviar (`:63`).

**Hueco:** si `doc.paciente_id` es `null` —posible, porque `paciente_id` solo se
inserta `if (pacienteId)` en los 8 formularios— **la validación de destinatario
se salta por completo** (`:75`: `if (doc.paciente_id) { ... }`). Un documento sin
paciente asociado puede enviarse a cualquier dirección sin confirmación ni
advertencia.

### 12.5 ¿Existe envío por WhatsApp u otro canal?

**No.** Búsqueda de `whatsapp` y `wa.me` en `src/`: las únicas coincidencias
están en textos legales y de marketing
(`src/components/legal/AvisoPrivacidadContent.tsx`,
`src/components/legal/TerminosContent.tsx`,
`src/components/landing/sections/SeccionFooter.tsx`) y en `src/types/index.ts`.
Ninguna es una integración de envío.

**El único canal alternativo real es `navigator.share`** — `mobileShare.ts:120-140`
(`compartirODescargar`), que en móvil abre la hoja de compartir nativa del
sistema con el PDF como `File` (`:121`, `:131`). Desde ahí el médico puede
enviarlo por WhatsApp, correo o cualquier app instalada, **pero eso ocurre fuera
de la aplicación y no deja ningún registro en `audit_log`**. Es la vía por la
que el PDF real llega al paciente, y es la vía sin trazabilidad.

En escritorio, `abrirBlobEnPestana` (`:96-114`) abre el PDF en una pestaña nueva
con un `blob:` URL revocado a los 60 s (`:109`).

### 12.6 Captura de la firma autógrafa del médico

**Componente:** `src/components/perfil/FirmaCaptura.tsx` (423 líneas).

**Dos modos de captura** (`:8`, selector en `:325-348`):

**Modo "dibujar"** (`:380-419`) — `<canvas>` de **600×220 px** (`:386-387`):
- Fondo blanco `#ffffff` (`:110-111`), trazo `#1a1a1a` (`:112`),
  `lineWidth: 2.5`, `lineCap:'round'`, `lineJoin:'round'` (`:113-115`).
- Suavizado con curvas cuadráticas al punto medio (`:142-145`).
- Soporta ratón (`:390-393`) y táctil con `preventDefault` (`:394-396`).

**Modo "subir"** (`:351-377`) — `<input type="file" accept="image/*" capture="environment">`
(`:368-375`), es decir permite tomar la foto con la cámara trasera.

**Procesamiento — `procesarImagen()` (`:16-80`), idéntico para ambos modos:**

1. Dibuja el origen en un canvas offscreen (`:21-26`).
2. **Grayscale + threshold** (`:32-39`): luminancia
   `0.299R + 0.587G + 0.114B`; si `L < 150` → píxel negro opaco
   (`0,0,0,255`); si no → **alfa 0** (transparente). Es decir, **el fondo se
   elimina y solo sobrevive el trazo oscuro**.
3. **Auto-crop** (`:42-60`): calcula el bounding box de píxeles opacos y añade
   12 px de padding. Si no hay ningún píxel opaco lanza *"No se detectó ningún
   trazo. Usa mejor iluminación o contraste."* (`:54`).
4. **Resize** (`:65-75`): escala a un máximo de **400×200 px** manteniendo
   proporción, con `Math.min(400/cropW, 200/cropH, 1)` — nunca amplía.
5. **Exporta con `final.toBlob(..., 'image/png')`** (`:77-79`).

**Formato de almacenamiento: PNG binario con fondo transparente, máximo
400×200 px.** No es base64 en base de datos, no es SVG, no son coordenadas.

**Dónde se guarda:**
- Se envía como `FormData` a `POST /api/me/firma` (`:209-211`).
- El endpoint valida `image/png` estricto (`route.ts:17-19`) y máx **1 MB**
  (`:20-22`).
- Sube a bucket **`firmas-medicos`** (privado, `:5`,
  `supabase/baseline/09_storage_buckets.sql:21-23`), ruta **`{user.id}/firma.png`**
  (`:25`), con `upsert: true` (`:30`).
- **En `profiles.firma_url` se guarda el PATH, no la URL** (`:36-40`), con el
  comentario explícito. La URL se genera on-demand como signed URL de 1 h
  (`:47-49` al subir; `api/me/perfil-medico/route.ts:49-55` al leer).

**Resolución con la que llega al PDF:** el PNG de hasta 400×200 px se dibuja a
140×52 pt en `PdfFirma.tsx:69` y a 120×44 pt en `RecetaPdf.tsx:237`, ambos con
`objectFit:'contain'`. A 72 dpi eso da ~2.9× de sobremuestreo horizontal — es
decir, hay resolución de sobra para impresión a 200 dpi pero **no** para 300 dpi
en el ancho completo.

### 12.7 ¿Se conservan los datos del trazo (coordenadas, tiempos)?

**No. Solo se conserva la imagen resultante.**

Durante el dibujo, las coordenadas viven exclusivamente en:
- `lastPt` — un `useRef` con **un único punto** (`:98`, actualizado en `:134` y
  `:146`).
- Los píxeles ya rasterizados en el `<canvas>`.

`terminarTrazo()` hace `lastPt.current = null` (`:152`). No hay array de puntos,
no hay timestamps, no hay presión, no hay velocidad. `procesarDibujo()` (`:184-195`)
toma `canvasRef.current` —el bitmap— y lo pasa a `procesarImagen`.

**No hay datos biométricos de firma dinámica** (los que darían valor probatorio a
una firma electrónica avanzada). Lo que se almacena es equivalente a una imagen
escaneada de un sello.

### 12.8 ¿Existe captura de firma de pacientes o de terceros?

**No en la aplicación clínica.**

Búsqueda de componentes de captura de firma en `src/`: solo dos archivos
implementan canvas de firma —

1. `src/components/perfil/FirmaCaptura.tsx` — la firma del **médico**, descrita
   arriba.
2. `src/components/landing/teaser2/FirmaCanvas.tsx` — **es una demo de la landing
   pública**, no un mecanismo de captura real. Pertenece al Teaser 2 de la
   landing, cuya regla permanente en `CLAUDE.md` prohíbe que toque la red.

En los documentos, las firmas de terceros son **espacios en blanco para firma
manuscrita sobre papel**:
- `SolicitudInternamientoPdf.tsx:418-422` — "Firma del Paciente o Familiar":
  una línea punteada con etiqueta, sin imagen.
- `ConsentimientoInformadoPdf.tsx:517-553` — seis `FirmaBox` con 48 pt de
  espacio en blanco (`:93-95`) y línea sólida (`:96-101`), sin ninguna
  referencia a datos de firma.

**Conclusión: no existe hoy ningún mecanismo de captura digital de firma de
pacientes o terceros en ninguna parte de la aplicación.** El consentimiento
informado —el documento que más lo requiere— se firma en papel.

---

## Bloque 13 — Expediente, storage e inmutabilidad

### 13.1 ¿Existe el concepto de "expediente del paciente" en el modelo de datos?

**No como entidad. Sí como agregación en tiempo de consulta.**

No hay tabla `expedientes`. El expediente es la unión implícita de:
`pacientes` (1) → `consultas` (N) → `addendums` (N), más `documentos` (N),
`mediciones_analitos` (N) y `appointments` (N), todas colgando de
`paciente_id`.

`pacientes` sí tiene atributos de expediente: `numero_expediente` (usado en
`documentos/page.tsx:57`), `activo` para soft delete
(`supabase_migration_soft_delete_pacientes.sql:4`) y `fecha_baja`
(`supabase_migration_retencion_expedientes.sql:13`).

**Función de exportación de expediente: sí, existen dos, distintas.**

**(a) `ExportarExpedienteButton` — PDF para el médico.**
`src/components/expediente/ExportarExpedienteButton.tsx`, montado en el Hero del
expediente.

- Consulta **todas** las consultas sin límite y en orden cronológico ascendente
  (`:48-52`), con comentario explícito de que no reutiliza las props del Hero
  porque vienen acotadas a 50 (`:45-47`).
- Trae todos los addendums de esas consultas en un solo query (`:60-66`).
- Refresca el perfil vivo del médico una vez para las N notas (`:72-78`).
- **Responsable del expediente = admin de la clínica**, no el autor de las notas,
  con el comentario "custodia NOM-004" (`:80-89`).
- Construye `hojaFrontal` (`buildHojaFrontalData`, `:91-103`) y N notas
  (`buildNotaRenderData`, `:105-113`).
- Genera con `generarPdf({ tipo: 'expediente_completo' })` (`:115-123`)
  → `ExpedienteCompletoPdf.tsx` (hoja frontal + N notas, con numeración continua
  de páginas según `:10`).
- **Sin `pacienteId` a propósito** (`:121-122`): el expediente completo **no se
  persiste en Storage**, solo se entrega al médico.
- Registra `accion: 'exportar_expediente'` en `audit_log` (`:127-135`),
  fire-and-forget, justificado como NOM-024.

**Nota de corrección respecto a la documentación del proyecto:** la sección
"Mejora B" de `CLAUDE.md` describe este export como generado *"vía print dialog
del navegador"* con footer `about:blank`. **Eso ya no es cierto**: hoy usa
`@react-pdf/renderer` a través del mismo pipeline `generarPdf` que los 8
formatos, y sí numera páginas. Los puntos B1-B6 de esa sección deben
reevaluarse contra el código actual antes de trabajarlos.

**(b) `POST /api/paciente/[id]/exportar` — JSON para derechos ARCO.**
`src/app/api/paciente/[id]/exportar/route.ts`. Devuelve datos personales,
consultas con addendums, mediciones con analito embebido, documentos y recetas.

**Corrección respecto a `CLAUDE.md` § "Pendientes de seguridad · QW3":** el
documento lo lista como pendiente. **Ya está cerrado.** El encabezado del
archivo (`:20-46`) documenta el cierre el 2026-07-31 (LP-DT-22): ahora exige
`canManageClinica(profile)` y excluye deliberadamente a `super_admin`, con dos
razones citadas del propio repo. Esa entrada de `CLAUDE.md` está obsoleta.

### 13.2 ¿Los documentos se asocian al expediente?

**Solo al paciente y, opcionalmente, a la consulta.** La tabla `documentos`
tiene `paciente_id` y `consulta_id` (`supabase/baseline/02_tables.sql:209-210`).

**`consulta_id` no lo escribe ninguno de los 8 formularios** — verificado en los
8 `insertPayload` (p. ej. `RecetaForm.tsx:372-381`, `SolicitudLabForm.tsx:170-177`).
La columna existe y queda siempre `null` para documentos generados. No hay forma
de saber en qué consulta se emitió una receta, más allá de la proximidad
temporal de `created_at`.

**`paciente_id` es opcional:** los formularios lo añaden solo
`if (pacienteId)` (p. ej. `RecetaForm.tsx:379`). Un documento generado fuera del
contexto de un paciente queda huérfano — sin paciente, sin expediente, y además
sin subida a Storage, porque `generarPdf` condiciona el upload a `pacienteId`
(`mobileShare.ts:222`).

El expediente exportado (§13.1a) **no incluye los documentos**: solo hoja
frontal y notas de consulta (`ExportarExpedienteButton.tsx:118`). Las recetas,
solicitudes y consentimientos **no aparecen en el PDF del expediente**.

### 13.3 ¿Cómo se almacenan las notas médicas?

**Como registros en base de datos. El PDF es opcional y efímero.**

- Tabla `consultas` (`supabase/baseline/02_tables.sql`), con
  `motivo_consulta`, `exploracion_fisica`, `diagnosticos` (jsonb),
  `plan_tratamiento`, `notas_evolucion`, `medicamentos` (jsonb), `pronostico`,
  `nota_origen` (`'ia'|'manual'`), más columnas snapshot del médico
  (`medico_nombre`, `medico_especialidad`, cédulas, logo) y, desde
  `20260615_consultorios_04_snapshot.sql`, 6 columnas de snapshot del
  consultorio.
- Se guarda vía `POST /api/consultas` (`nueva-nota/page.tsx:706-710`).
- Correcciones por **addendum** (tabla `addendums`), nunca edición — coherente
  con la regla de inmutabilidad del proyecto.

**El PDF de la nota no se persiste.** El handler `imprimir()` de
`nueva-nota/page.tsx` (`:737` en adelante) llama `generarPdf({ tipo:
'nota_evolucion' })` **sin `pacienteId`**, con el comentario explícito en el
propio código: *"Sin pacienteId: imprimir NO persiste en Storage (solo entrega
el PDF)"*. Es decir: **las notas médicas viven solo como filas; su
representación impresa se regenera cada vez.**

Esto es coherente y deliberado, pero tiene una consecuencia: al no haber PDF
almacenado ni versión de formato (§7.6), **la nota impresa hoy y la impresa
dentro de un año pueden no ser visualmente idénticas** si el renderer cambia.

### 13.4 Políticas de storage

**Cuatro buckets** (`supabase/baseline/09_storage_buckets.sql`):

| Bucket | Público | Límite | MIME permitidos | Uso |
|---|:-:|---|---|---|
| `clinica-logos` | **Sí** | Sin límite | Sin restricción | Logos de clínica |
| `documentos-pdf` | No | Sin límite | Sin restricción | **Los PDFs de los 8 formatos** |
| `firmas-medicos` | No | Sin límite | Sin restricción | Firma autógrafa |
| `labs-documentos` | No | 50 MB | PDF, JPEG, PNG, DICOM, octet-stream | Uploads clínicos |

**Políticas RLS de `documentos-pdf`** — estado vigente según
`supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql`
(aplicado en producción el 2026-06-03):

Las 3 policies abiertas originales (`authenticated_select/insert/delete` de
`supabase_migration_storage_documentos_pdf.sql:13-25`, que solo exigían
`bucket_id = 'documentos-pdf'`) fueron **eliminadas** (`:85-87`) y sustituidas
por tres atadas al médico tratante (`:90-124`):

```sql
bucket_id = 'documentos-pdf'
AND auth.uid() IS NOT NULL
AND soy_medico_tratante(
  CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-...-[0-9a-f]{12}$'
       THEN ((storage.foldername(name))[1])::uuid END
)
```

`documentos_pdf_select_tratante`, `documentos_pdf_insert_tratante`,
`documentos_pdf_delete_tratante`. El `CASE`-guard sobre el cast a uuid está
justificado en el propio archivo (`:32-43`) por el orden de evaluación no
garantizado del `AND` en Postgres.

**Consecuencia documentada** (`:24-30`): ni admin ni secretaria acceden a estos
documentos. Y (`:45-50`): 15 de los 222 documentos del bucket quedaron
inaccesibles vía app (14 de pacientes inexistentes, 1 sin vínculo vigente);
decisión del dueño de no backfillear en beta.

**Nota sobre `09_storage_buckets.sql:43-49`:** el baseline advierte que las
storage policies **no se pudieron volcar** y deben recuperarse manualmente del
dashboard. Es decir, **el baseline no reproduce el estado de seguridad real de
Storage**; la fuente autoritativa son las migraciones puntuales.

**¿Puede un médico borrar o sobrescribir un PDF ya generado?**

**Sí, ambas cosas, y por varias vías:**

| Vía | Mecanismo | Referencia |
|---|---|---|
| **Sobrescribir desde la app** | `generarPdf` sube con `upsert: true`. Mismo paciente + mismo tipo + mismo minuto ⇒ el archivo se reemplaza | `mobileShare.ts:234` |
| **Sobrescribir desde la app (regeneración)** | `regenerarYSubirPdf` vuelve a llamar `generarPdf` con el mismo `pacienteId` | `ModalDocumentos.tsx:129-136` |
| **Borrar desde la app** | `DELETE /api/documentos/[id]` hace **hard delete** de la fila y luego `storage.remove([doc.pdf_url])` | `api/documentos/[id]/route.ts:23`, `:32-38` |
| **Borrar directo contra Storage** | La policy `documentos_pdf_delete_tratante` **permite DELETE** al médico tratante. Con el token de sesión y el path se puede borrar sin pasar por la app | migración `:114-124` |
| **Sobrescribir directo contra Storage** | `documentos_pdf_insert_tratante` cubre el upsert (nota `:52-55` de la migración lo confirma: *"El upsert:true de la subida se resuelve por la ruta INSERT"*) | migración `:102-112` |

**¿Hay versionado activado en el bucket?** **No.** El `INSERT` de creación del
bucket (`09_storage_buckets.sql:16-18`) no activa versionado, y Supabase Storage
no lo ofrece por defecto. **NO DETERMINADO** si está activado a nivel de
proyecto desde el dashboard; verificarlo requiere consultar la configuración de
Storage en Supabase, fuera del repositorio.

**Contraste relevante:** las notas médicas son inmutables por diseño (addendums,
sin UPDATE) y el `audit_log` tiene trigger de inmutabilidad
(`supabase_migration_audit_immutable.sql`). **Los PDFs de documentos no tienen
ninguna de las dos protecciones.**

### 13.5 ¿Existe cálculo de hash de los archivos generados?

**No.** Ya establecido en §7.4 y §11.10. Sin columna, sin cálculo en el
pipeline, sin verificación. Búsqueda de `sha`, `digest`, `checksum`, `hash` en
`src/lib/mobileShare.ts`, `src/lib/pdfClientFallback.ts` y los 8 formularios:
cero resultados.

### 13.6 Cifrado a nivel de aplicación

**Sobre archivos almacenados: no existe.** Los PDFs se suben tal cual
(`mobileShare.ts:230-235`) y se recuperan con signed URLs
(`ModalDocumentos.tsx:86-88`, TTL 900 s). Más allá del cifrado en reposo por
defecto de Supabase, no hay capa propia.

**Sí existe cifrado de aplicación, pero solo en el cliente y solo para caché.**
`src/lib/secureStorage.ts` se usa para:
- el caché del perfil médico (`useMedicoInfo.ts:21`, clave `cache_medico_info`),
- el borrador de la nota médica (`nueva-nota/page.tsx:722` — `secureStorage.remove(draftKey)`),
- el perfil de usuario (`spinus_sec_cache_user_profile`, referido en
  `NotaHonorariosForm.tsx:103` con el comentario *"secureStorage cifra — no
  podemos leer directo"*).

**Manejo de claves propio: NO DETERMINADO.** `src/lib/secureStorage.ts` no fue
leído en esta auditoría; determinar el algoritmo, el origen de la clave y su
rotación exige revisarlo. Lo que sí queda establecido es que **su alcance es
`localStorage` del navegador, no los archivos en Storage**.

Contraste: `spinus_doctor_profile` —que contiene el logo y **la firma autógrafa
del médico en Base64**— se guarda en `localStorage` **sin cifrar**
(`doctorProfile.ts:117`: `localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))`).

### 13.7 Adjuntos vinculados a un documento

**No existe el concepto. Cada documento es un archivo único.**

`documentos` no tiene tabla hija de adjuntos ni columna de array de archivos.
Tiene dos juegos de columnas mutuamente excluyentes según el origen:

| Origen | Columnas usadas | Columnas nulas |
|---|---|---|
| PDF generado por la app | `contenido` (jsonb), `pdf_url` | `storage_bucket`, `storage_path`, `mime_type`, `tamaño_bytes`, `nombre_original` |
| Upload clínico | `storage_bucket`, `storage_path`, `mime_type`, `tamaño_bytes`, `nombre_original`, `contenido` mínimo | `pdf_url` |

El CHECK `documentos_tiene_origen_check` (`02_tables.sql:231-233`) exige que al
menos uno de los dos exista.

**Mecanismo de carga de imágenes / estudios** —
`src/components/labs/ModalSubirDocumento.tsx` + `src/lib/labs/upload-utils.ts`:

| Aspecto | Detalle | Ref. |
|---|---|---|
| Bucket | `labs-documentos` | `ModalSubirDocumento.tsx:17` |
| Ruta | `clinicas/{clinicaId}/pacientes/{pacienteId}/{uuid}.{ext}` | `upload-utils.ts:77-85` |
| `upsert` | **`false`** — no sobrescribe | `ModalSubirDocumento.tsx:200` |
| Límites de tamaño | Imagen 5 MB, PDF 15 MB, DICOM 50 MB | `upload-utils.ts:5-7` |
| Formatos | JPEG, PNG, PDF, DICOM (`.dcm`) | `:37-57` |
| Normalización MIME | `.dcm` → `application/dicom` aunque el navegador diga `octet-stream` | `:26-31` |
| **Compresión** | Solo imágenes > 500 KB: `browser-image-compression` a **máx 1 MB / 1920 px**, con web worker; si falla devuelve el original | `:62-75` |
| Tipos permitidos | `resultado_laboratorio`, `estudio_imagen` | `:3` |
| Rollback | Si el INSERT falla, elimina el archivo del bucket | `ModalSubirDocumento.tsx:220-223` |
| Descripción | `maxLength` 200 | `ModalSubirDocumento.tsx:18`, `:410` |

**Este mecanismo es más robusto que el de los PDFs generados** en tres ejes:
`upsert:false` (no sobrescribe), path con UUID (sin colisión posible) y
rollback transaccional. Los PDFs de los 8 formatos no tienen ninguno de los
tres.

Nota: la ruta de este bucket incluye `clinicas/{clinicaId}/` mientras
`documentos-pdf` usa solo `{pacienteId}/`. Dos convenciones de partición
distintas en el mismo sistema.

### 13.8 Estado o ciclo de vida de los documentos

**No existe. Todo documento generado es final desde el instante en que se
inserta.**

- `documentos` no tiene columna `estado`, `status`, `borrador`, `emitido` ni
  `anulado` (`supabase/baseline/02_tables.sql:207-234`).
- El CHECK de la tabla restringe `tipo`, no estado (`:223-230`).
- No hay transición ni máquina de estados en ningún punto del código.

El flujo es de un solo paso: el médico pulsa "Imprimir", se genera el PDF, se
sube y se inserta la fila. **No hay paso previo de borrador ni confirmación**, y
no hay forma de anular un documento salvo borrarlo (hard delete, §13.4).

Contraste directo dentro del mismo producto: la **nota médica sí tiene el
patrón completo** de borrador → confirmación → sellado (§13.9). Los documentos
no lo tienen.

### 13.9 Patrón de borrador de las notas médicas (candidato a reutilización)

Ubicación: `src/app/(app)/expediente/[id]/nueva-nota/page.tsx` (1 944 líneas).

**Máquina de estados** — `:85`:

```ts
type EstadoModal = 'generando' | 'entrevista' | 'revision' | 'contexto'
                 | 'confirmacion' | 'exito' | null
```

Estado en `:203` (`const [estadoModal, setEstadoModal] = useState<EstadoModal>(null)`).

**Metadatos por estado** — `metaDelModal()` (`:94-103`), que devuelve
`{ title, subtitle, geometry }` con cuatro geometrías: `'work'`, `'decide'`,
`'done'`, `'wait'`.

| Estado | Título | Subtítulo | Geometría |
|---|---|---|---|
| `generando` | "Spinus está redactando tu nota" | "Unos segundos…" | `wait` |
| `entrevista` | "Spinus necesita más información" | "Responde para completar la nota" | `work` |
| `revision` | "Tu nota está lista" | "Revísala antes de guardar" | `work` |
| `contexto` | "Ajusta el contexto" | "La nota se generará de nuevo" | `work` |
| `confirmacion` | (vacío) | (vacío) | `decide` |
| `exito` | (vacío) | (vacío) | `done` |

**Componente del modal:** `ModalShell` (`src/components/ui/ModalShell.tsx`),
montado una sola vez en `:910` con `open={estadoModal !== null}`. El contenido
se conmuta por estado (`:1039`, `:1066`, `:1129`, `:1291`, `:1307`, `:1340`) con
un wrapper que fuerza remount por `key={estadoModal}` (`:1038`).

**Qué acción lo dispara:** `intentarGuardar()` (`:662-677`):

```ts
function intentarGuardar() {
  if (modoNota === 'manual') { if (!validarManualParaAbrir()) return }
  else {
    if (!form.motivo_consulta.trim()) { setError('Describe el caso antes de guardar.'); return }
    if (!notaGenerada.trim())        { setError('Genera la nota antes de guardar.'); return }
    if (!validarVitalesDuros()) return
  }
  // Confirmación universal (blueprint §5.1): SIEMPRE muta al estado de
  // confirmación. Murió el flag spinus_skip_confirm_nota y su checkbox.
  setEstadoModal('confirmacion')
}
```

**La confirmación es universal y no se puede desactivar** — el comentario
`:674-676` documenta que el flag de "no volver a preguntar" fue eliminado a
propósito.

**Textos exactos del estado de confirmación** (`:1307-1338`):

- Ícono: `<Save />` en `.sp-icobox--lg` con tokens `--sp-danger-bg` /
  `--sp-danger` y `animation: pulse 1.5s ease-in-out infinite` (`:1312-1315`).
- Título: **"¿Guardar esta nota?"** (`:1320`), envuelto en
  `.animate-alert-glow`.
- Cuerpo (`:1323-1326`):
  > "Una vez guardada, **no podrá modificarse** por motivos de seguridad y
  > cumplimiento normativo. Si necesitas hacer correcciones después, podrás
  > agregar una nota aclaratoria (addendum)."
  
  con "no podrá modificarse" en `font-bold` y `--sp-danger-strong`.
- Advertencia condicional (`:1327-1331`): si `sinVitalesCapturados`,
  banner `sp-banner--warn` con "⚠ No capturaste signos vitales en esta nota."
- Errores del guardado se muestran **dentro** del modal (`:1333-1337`,
  `sp-banner--danger`), con el motivo documentado en `:715-716`: un banner de
  página quedaría detrás del backdrop.

**Guardado** — `guardar()` (`:680-732`): `POST /api/consultas`, y al terminar
`secureStorage.remove(draftKey)` (`:722`), `setNotaSaved(true)` (`:723`) y
`setEstadoModal('exito')` (`:724`).

**Borrador persistente:** se cifra en `secureStorage` bajo `draftKey`, se
restaura al montar (`:256-309`) con banner "borrador restaurado" (`:1413-1414`),
no se guarda si la nota ya se persistió (`:339`), y se borra al guardar
(`:722`).

**Detalles de UX ya resueltos que conviene no perder al generalizar:**
- `hideClose` mientras genera o en confirmación (`:914`) — no se puede cerrar a
  mitad de una decisión.
- Navegación hacia atrás explícita: desde `confirmacion` vuelve a `revision`
  (`:554`); desde `exito` cierra (`:556`).
- Dirección de la animación derivada del estado anterior sin estado extra
  (`claseTransicion`, `:113-117`, con `prevEstadoRef`).

**Valoración de generalizabilidad para el sellado del consentimiento:**

| Pieza | Estado | Reutilizable |
|---|---|---|
| `ModalShell` con geometrías | Componente genérico en `src/components/ui/` | **Sí, directamente** |
| Tokens visuales (`sp-icobox`, `sp-banner`, `sp-medal`, `--sp-danger*`) | En `spinus-tokens.css` / `globals.css` | **Sí** |
| Máquina de estados `EstadoModal` | **Definida dentro de `nueva-nota/page.tsx`** (`:85`), no exportada | **No** — hay que extraerla |
| `metaDelModal`, `claseTransicion` | Funciones locales del archivo (`:94`, `:113`) | **No** — extraer |
| Textos de confirmación | Hardcodeados en JSX (`:1318-1326`) | **No** — parametrizar |
| Borrador cifrado | Acoplado a `draftKey` de la nota y a su forma de datos | Parcial |
| Confirmación universal no desactivable | Decisión de producto ya tomada y documentada | **Sí, como principio** |

**Resumen:** el patrón está maduro y bien razonado, pero **vive entero dentro de
un archivo de 1 944 líneas y nada de él está extraído**. Reutilizarlo exige
extraer la máquina de estados, los metadatos y los textos a un módulo
parametrizable; el `ModalShell` y los tokens sí se pueden usar tal cual.

### 13.10 Sección "Documentos del paciente"

**Dónde vive:** es un modal, no una página.
`src/components/expediente/ModalDocumentos.tsx`, montado desde
`src/app/(app)/expediente/[id]/page.tsx:152-159` y abierto desde
`AccesosRapidos` (`onAbrirDocumentos`, `:242`).

**De qué tabla lee:** `documentos`, con query directa a Supabase desde el
cliente — `expediente/[id]/page.tsx:79-87`:

```ts
supabase.from('documentos').select('*')
  .eq('paciente_id', id)
  .order('created_at', { ascending: false })
  .limit(QUERY_LIMIT)
```

`QUERY_LIMIT` es 50 — la limitación ya registrada en `CLAUDE.md` § Deuda
técnica #3. Refetch tras borrado con `fetchDocumentos` (`:44-53`).

**Qué lista** (`ModalDocumentos.tsx:199-248`), una fila por documento:
- Ícono por tipo (`iconForTipo`, `:43-56`, 9 tipos + default).
- Badge de color y etiqueta (`TIPO_DOC_LABEL` `:18-28`, `TIPO_DOC_COLOR` `:31-41`).
- Fecha y hora de creación (`d 'de' MMMM yyyy, HH:mm`, `:209`) + diagnóstico si
  existe (`:210`).
- Acciones: Descargar (si `pdf_url`, `:214-221`) **o** Regenerar (si no hay
  `pdf_url` pero sí `contenido`, `:222-231`); Ver (`:232-238`); Eliminar
  (`:239-245`).
- Enlace "+ Nuevo documento" en el header, con intercept de bloqueo por
  suscripción (`:161-178`).

**¿Distingue por estado?** **No — los muestra todos por igual.** No hay filtro,
ni pestañas, ni agrupación por tipo, ni búsqueda, ni indicador de estado
(coherente con §13.8: no existen estados). El único eje de diferenciación visual
es el tipo de documento.

**Observaciones adicionales:**
- Los uploads clínicos (`resultado_laboratorio`, `estudio_imagen`) **también
  viven en la tabla `documentos`** y por tanto aparecen en este listado, pero
  `TIPO_DOC_LABEL` y `TIPO_DOC_COLOR` (`:18-41`) **no los incluyen**: caen al
  fallback y se muestran con el `tipo` crudo (`receta` → "Receta", pero
  `estudio_imagen` → `estudio_imagen`) y badge gris.
- Los tres comentarios "Duplicado de TabDocumentos.tsx — Fase 7 eliminará
  TabDocumentos" (`:17`, `:30`, `:81`, `:98`) apuntan a un archivo que **ya no
  existe** en el repositorio; los mapas duplicados quedaron sin su gemelo.
- Existe además una tercera copia de `TIPO_DOC_LABEL`/`TIPO_DOC_COLOR` en
  `ModalVisorDocumento.tsx:10-31` y una cuarta de `TIPO_LABEL` en
  `api/email/enviar-documento/route.ts:12-22`. **Cuatro copias del mismo mapa**,
  con diferencias: `ModalDocumentos` dice "Honorarios / Cotización",
  `ModalVisorDocumento` dice "Nota de Honorarios", el email dice "Recibo de
  honorarios".

---

## Hallazgos por severidad

Enunciados con ubicación. Sin propuestas de solución.

Nivel 1 — **validez médico-legal del documento como registro**: identificación
del paciente y del médico, trazabilidad y folio, paginación e integridad
multipágina, campos en blanco sin resolución, y datos de consultorio incorrectos
o desactualizados. No incluye contenido clínico.

---

### Nivel 1 — Afectan la validez médico-legal del documento

**ML-01.** La segunda página del Internamiento ("Indicaciones de Ingreso a
Piso") se emite **sin nombre de paciente, sin fecha y sin folio**. Es la hoja
destinada a enfermería y médico residente, y es inatribuible si se separa de la
página 1.
`src/lib/pdf/SolicitudInternamientoPdf.tsx:436-474`, header sin fecha ni folio en `:440`.

**ML-02.** **Ningún documento de los 8 incluye numeración de páginas ni total de
páginas.** Afecta de forma directa a los dos formatos multipágina —
Internamiento (1-2 páginas) y Consentimiento (3-4 páginas): no hay forma de
detectar una hoja faltante en un expediente físico.
`src/lib/pdf/*.tsx` — cero usos de `render={({ pageNumber })}`; el estilo
`baseStyles.pageNumber` existe sin usarse en `src/lib/pdf/PdfStyles.tsx:161-167`.
Contraste: `src/lib/pdf/NotaEvolucionPdf.tsx:531-533` sí lo implementa.

**ML-03.** El bloque "FIRMA Y SELLO" queda superpuesto por la banda del footer
en Internamiento (ambas páginas) y en Consentimiento.
`src/lib/pdf/SolicitudInternamientoPdf.tsx:46` (`paddingBottom: 42`, único de
los 8 que no reserva 54), `:215` (`firmasRow.marginTop: 60`), `:417` y `:463`
(firma fuera del `flex:1`);
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:776` y `:835`;
`src/lib/pdf/PdfBarras.tsx:36-46` (banda sin altura acotada, crece si la
dirección envuelve).

**ML-04.** Campos etiquetados se imprimen como cajas vacías sin resolución. La
causa es el uso de `??` sobre campos que llegan como `''`, nunca `null`.
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:642-643` (NO. EXPEDIENTE), `:654-655`
(IDENTIFICACIÓN PACIENTE), `:662-663` (IDENTIFICACIÓN FAMILIAR);
`src/lib/pdf/SolicitudLabPdf.tsx:266-269` (DIAGNÓSTICO, sin fallback alguno);
`src/lib/pdf/SolicitudImagenPdf.tsx:219-222` (DIAGNÓSTICO).

**ML-05.** Los seis recuadros de firma del Consentimiento se imprimen siempre,
sin condicional. Con anestesiólogo y testigos vacíos —el caso normal, son campos
opcionales— el documento emite tres bloques de firma con línea y etiqueta y sin
nombre, en un consentimiento informado.
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:514-556`; `FirmaBox` sin guarda de
contenido en `:126-140`; repetido íntegro en la página 4 en `:835`.

**ML-06.** **Ningún documento imprime la hora**, aunque el nombre del archivo sí
la lleva y la página pública de verificación de la receta también.
Formato de fecha sin componente horario en los 8 formularios (p. ej.
`src/components/documentos/RecetaForm.tsx:287`);
hora en el archivo en `src/lib/patientUtils.ts:143-146`;
hora visible al público en `src/app/r/[folio]/page.tsx:56-60`.
Además, la hora del nombre del archivo es la de generación, no la del documento
(`src/lib/patientUtils.ts:139`).

**ML-07.** Todo PDF regenerado desde el expediente imprime la dirección y el
teléfono **legacy de `profiles`**, no los del consultorio activo, porque
`regenerarYSubirPdf` no importa ni pasa `consultorio`.
`src/components/expediente/ModalDocumentos.tsx:99-148`, en particular `:118-119`
y `:129-136`; consumo del fallback en `src/lib/pdf/PdfHeader.tsx:31-32` y
`src/lib/pdf/PdfBarras.tsx:22-23`.

**ML-08.** Los datos legacy de consultorio llegan al papel por otras tres rutas
además de ML-07: sin consultorio activo hidratado
(`src/contexts/ConsultorioActivoContext.tsx:49-56`), fuera del Provider mediante
el fallback silencioso (`:86-94`), y en modo offline desde
`spinus_doctor_profile` (los 8 formularios, p. ej.
`src/components/documentos/RecetaForm.tsx:157-158`).

**ML-09.** El PDF regenerado **no es reproducible**: usa el perfil del médico
guardado en `localStorage` en vez del vivo, y genera otro nombre de archivo con
otro timestamp. Un documento regenerado puede llevar membrete, colores, logo,
firma y dirección distintos del original.
`src/components/expediente/ModalDocumentos.tsx:104-123` (origen `getDoctorProfile()`),
`:127` y `:134` (nombre derivado del tipo crudo).

**ML-10.** **No existe ninguna noción de versión de formato en el sistema.** No
hay forma de saber con qué versión del renderer se emitió un PDF histórico ni de
reproducir su aspecto original tras un rediseño.
Tabla `documentos` sin columna de versión —
`supabase/baseline/02_tables.sql:207-234`. Única excepción parcial: el esquema
del cuerpo del Escrito Médico en
`src/components/documentos/EscritoMedicoForm.tsx:167`.

**ML-11.** **No se calcula ni almacena hash de los PDFs generados.** La página
de verificación confirma el registro en base de datos, no el papel que tiene el
paciente: no puede detectar alteración del PDF impreso ni divergencia entre
`contenido` y el archivo almacenado.
Sin columna en `supabase/baseline/02_tables.sql:207-234`; sin cálculo en
`src/lib/mobileShare.ts:172-262`.

**ML-12.** `contenido` es una columna `jsonb` actualizable **sin trigger de
inmutabilidad**, y es la fuente de verdad de la página pública de verificación.
`supabase/baseline/06_triggers.sql` (sin guarda sobre `documentos`); el trigger
de inmutabilidad existente cubre solo `audit_log`
(`supabase_migration_audit_immutable.sql`).

**ML-13.** Un médico puede **borrar y sobrescribir** un PDF ya emitido, desde la
app y directamente contra Storage. El borrado es hard delete de la fila más
eliminación del archivo.
`src/app/api/documentos/[id]/route.ts:23` y `:32-38`;
policies `documentos_pdf_delete_tratante` e `..._insert_tratante` en
`supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql:102-124`;
`upsert: true` en `src/lib/mobileShare.ts:234`.
Sin versionado de bucket (`supabase/baseline/09_storage_buckets.sql:16-18`).

**ML-14.** Dos documentos del mismo tipo y paciente emitidos **en el mismo
minuto** producen dos filas en `documentos` pero **un solo archivo**: el segundo
sobrescribe al primero, que queda con un registro válido apuntando a un PDF que
no es el suyo.
Nombre con resolución de minuto en `src/lib/patientUtils.ts:146`;
`upsert: true` en `src/lib/mobileShare.ts:234`.

**ML-15.** **La generación de documentos no deja ningún registro en
`audit_log`.** La única ruta que audita `'generar_pdf'` es la ruta server, que
está muerta: ningún archivo del proyecto la invoca.
`src/app/api/generar-pdf/route.ts:77` (audita) vs. `src/lib/mobileShare.ts`
(pipeline real, sin auditoría).

**ML-16.** **Los accesos a la página pública de verificación no se registran.**
La acción `'verificar_receta'` está declarada en el catálogo de auditoría y
anunciada en el encabezado del módulo, pero **nunca se emite**.
Declarada en `src/lib/audit.ts:26` y `:10`; cero llamadas en
`src/app/r/[folio]/page.tsx` y `src/app/api/r/[folio]/route.ts`.

**ML-17.** El folio de la receta **es simultáneamente el identificador visible
en el papel y la llave completa de acceso** a la página pública con contenido
clínico y nombre del paciente. No hay secreto separado, ni caducidad, ni
revocación, ni estado.
`src/components/documentos/RecetaForm.tsx:246` y `:271` (mismo valor),
`src/lib/pdf/PdfHeader.tsx:168` (impreso), `src/app/r/[folio]/page.tsx:36-41`
(llave de consulta).

**ML-18.** La página pública `/r/[folio]` **no tiene rate limiting**, mientras
el endpoint JSON equivalente sí lo tiene. Ambos devuelven el mismo dato con
service role; la protección es eludible cambiando de ruta.
`src/app/api/r/[folio]/route.ts:6-8` (protegido, 30/h por IP) vs.
`src/app/r/[folio]/page.tsx:35-41` (sin protección);
excepción de middleware en `src/middleware.ts:58`.

**ML-19.** La ruta pública `/r/` **no tiene ninguna señal de no-indexación** en
toda la cadena: sin `X-Robots-Tag`, sin meta robots, sin `robots.txt`.
`next.config.ts:4-10` (`securityHeaders` sin `X-Robots-Tag`);
`src/app/r/[folio]/page.tsx` sin `metadata` ni `generateMetadata`;
`src/app/layout.tsx:4-7` sin `robots`; no existe `robots.ts`/`robots.txt` ni
`sitemap.ts`/`sitemap.xml` en el proyecto.

**ML-20.** El correo al paciente **transcribe el contenido clínico completo en
el cuerpo del mensaje** —medicamentos con posología, recomendaciones íntegras,
cuerpo completo del escrito médico— y el asunto revela el tipo de documento
clínico. No se adjunta el PDF ni se envía enlace.
`src/app/api/email/enviar-documento/route.ts:152-266` (cuerpo), `:121` (asunto),
`:118-123` (llamada sin `attachments`).

**ML-21.** La validación de destinatario del correo **se salta por completo** si
el documento no tiene `paciente_id`. Un documento sin paciente asociado puede
enviarse a cualquier dirección sin confirmación.
`src/app/api/email/enviar-documento/route.ts:75` (`if (doc.paciente_id)`);
`paciente_id` opcional en los 8 formularios (p. ej.
`src/components/documentos/RecetaForm.tsx:379`).

**ML-22.** El PDF real llega al paciente por `navigator.share` en móvil, es
decir **fuera de la aplicación y sin ningún registro de auditoría**. Es la vía
principal de entrega y es la única sin trazabilidad.
`src/lib/mobileShare.ts:120-140` y `:256-257`.

**ML-23.** `consulta_id` existe en `documentos` pero **ninguno de los 8
formularios lo escribe**: no hay forma de saber en qué consulta se emitió un
documento.
Columna en `supabase/baseline/02_tables.sql:210`; los 8 `insertPayload`
(p. ej. `src/components/documentos/RecetaForm.tsx:372-381`).

**ML-24.** El PDF del expediente exportado **no incluye los documentos** —solo
hoja frontal y notas de consulta. Recetas, solicitudes y consentimientos quedan
fuera del expediente exportado.
`src/components/expediente/ExportarExpedienteButton.tsx:118`.

**ML-25.** El bloque de Internamiento del correo al paciente **siempre sale
vacío**: lee tres claves que el formulario no escribe.
Lee `contenido.hospital`, `contenido.motivo`, `contenido.tipo_internamiento` en
`src/app/api/email/enviar-documento/route.ts:231-233`; el formulario guarda
`lugar`, `justificacion`, `tipoInternamiento` en
`src/components/documentos/SolicitudInternamientoForm.tsx:122-125`.

**ML-26.** Es posible emitir una receta **sin ningún medicamento**: si ninguna
fila tiene nombre comercial, el filtro deja el array vacío y la tabla se imprime
con encabezado y cero filas.
Filtro en `src/components/documentos/RecetaForm.tsx:288`; botón que solo exige
paciente en `:542`; render sin guarda en `src/lib/pdf/RecetaPdf.tsx:550-590`.

**ML-27.** El Plan de Suplementación **no deja registro en `documentos`** si se
genera sin `pacienteId`: el PDF se entrega pero no queda rastro.
`src/components/documentos/PlanSuplementacionForm.tsx:345-367`.

**ML-28.** El folio de Honorarios es **totalmente derivado y enumerable**
(fecha + segundo del día), y dos documentos emitidos en el mismo segundo obtienen
el mismo folio.
`src/components/documentos/NotaHonorariosForm.tsx:40-46`.

**ML-29.** La firma autógrafa del médico **no aparece en Internamiento ni en
Consentimiento** — los dos formatos que no leen `medico.firma_url`.
`src/lib/pdf/SolicitudInternamientoPdf.tsx:417-431` y `:463-473`;
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:87-141`.
Sí aparece en los otros 6 (`src/lib/pdf/PdfFirma.tsx:65-72`,
`src/lib/pdf/RecetaPdf.tsx:235-239`).

**ML-30.** El logo y **la firma autógrafa del médico en Base64** se guardan en
`localStorage` **sin cifrar**, mientras otros datos del perfil sí usan
`secureStorage`.
`src/lib/offline/doctorProfile.ts:117`; contraste con
`src/hooks/useMedicoInfo.ts:21`.

---

### Nivel 2 — Afectan la calidad visual

**QV-01.** Solicitud de Laboratorio renderiza el **encabezado de una segunda
columna sin filas** con número impar de estudios, y de forma más visible con uno
solo.
`src/lib/pdf/SolicitudLabPdf.tsx:35-37` (partición), `:281` (llamada
incondicional), `:205-209` (header incondicional dentro de `renderColumn`).

**QV-02.** La página 2 del Internamiento se emite **con contenido
prácticamente vacío**: la condición es truthiness del string crudo, sin `trim()`
ni longitud mínima. Un espacio o un carácter generan una página completa.
`src/lib/pdf/SolicitudInternamientoPdf.tsx:435`.

**QV-03.** El Escrito Médico emite **viñetas vacías**. La lista se renderiza sin
filtrar ítems sin contenido y el marcador se emite antes de resolver los hijos.
`src/lib/pdf/EscritoMedicoPdf.tsx:356-359` y `:335`.
En la ruta legacy el bullet se inyecta en el texto y sobrevive a los filtros:
`src/components/documentos/EscritoMedicoForm.tsx:56` y `:65`.

**QV-04.** El saneamiento del Escrito Médico **se aplica a la rama que el
renderer ignora**. `sanitizeEditorHtml` limpia el HTML, pero al PDF viaja
`docJson` crudo, y esa es la rama activa.
`src/components/documentos/EscritoMedicoForm.tsx:154` (sanea `cuerpo`) vs.
`:204` (envía `doc` sin sanear);
bifurcación del renderer en `src/lib/pdf/EscritoMedicoPdf.tsx:453`.
Además, DOMPurify es saneamiento de seguridad, no de contenido: no elimina
elementos vacíos (`:28-35`).

**QV-05.** El `letterSpacing` de los títulos fuerza la fragmentación **glifo por
glifo** en el operador `TJ` de los seis formatos que lo usan, rompiendo la
extracción de texto en tres de ellos.
`src/lib/pdf/SolicitudLabPdf.tsx:74`, `src/lib/pdf/PlanSuplementacionPdf.tsx:280`,
`src/lib/pdf/SolicitudInternamientoPdf.tsx:78` (rotos);
`src/lib/pdf/SolicitudImagenPdf.tsx:195`,
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:300`,
`src/lib/pdf/NotaHonorariosPdf.tsx:93` (correctos).
Mecanismo en `node_modules/@react-pdf/render/lib/index.js:172-175`.
**La razón del reparto concreto entre los dos grupos es NO DETERMINADO** — ver
§8.5: ni la magnitud del ajuste, ni la ubicación del estilo, ni la composición
del texto separan los grupos, y los títulos de Imagen y Suplementación son
tipográficamente idénticos con comportamiento opuesto.

**QV-06.** El logo del membrete se declara **80×40 dentro de un contenedor
circular de 52×52 con `overflow:'hidden'`**: el ancho excede el contenedor en 28
pt y el círculo recorta las esquinas.
`src/lib/pdf/PdfHeader.tsx:52-67`. La rama de 62 px es código muerto: los 8
formatos pasan `compact`.

**QV-07.** La marca de agua se dimensiona a **220×220 sin `objectFit`**: todo
logo no cuadrado se deforma. Se instancia en `<View fixed>`, por lo que se
repite en todas las páginas desde la misma fuente Base64 que el membrete.
`src/lib/pdf/PdfWatermark.tsx:17-22` y `:29`.

**QV-08.** El título del Consentimiento y el de Honorarios **se vuelven
ilegibles con un color primario claro**: son los dos únicos formatos que pintan
el título *con* el color del médico en lugar de *sobre* él.
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:299` sobre `:288`;
`src/lib/pdf/NotaHonorariosPdf.tsx:92` sobre fondo blanco.
El mecanismo de protección existe y funciona en los otros
(`src/lib/pdf/PdfStyles.tsx:86-93`).

**QV-09.** El subtítulo de la columna "Complemento" de Imagen usa **blanco fijo
`#ffffffcc` sobre fondo del color del médico**, en el mismo header donde las
otras tres columnas sí aplican `contrastText`.
`src/lib/pdf/SolicitudImagenPdf.tsx:118-121` sobre `:80`.

**QV-10.** El QR de verificación tiene el color oscuro **hardcodeado a
`#1a3a5c`**, ajeno a la paleta del médico e inconsistente con el segundo QR del
mismo archivo, que sí la usa.
`src/components/documentos/RecetaForm.tsx:276` vs. `:282`.

**QV-11.** Nueve elementos pierden su significado al imprimir en blanco y negro.
El más grave es el sistema semántico de 5 categorías de la Receta, donde el
bloque de **Datos de Alarma** queda visualmente igual que una recomendación
normal.
`src/lib/pdf/RecetaPdf.tsx:54-181`, triángulo en `:108`;
badge "Cita de control" que desaparece por completo en
`src/lib/pdf/PlanSuplementacionPdf.tsx:203-227`;
zebra al 5 % en Receta `:383`, Lab `:168`, Imagen `:130`, Suplementación `:331`.

**QV-12.** El reparto de secciones del Consentimiento está **codificado por
índice, no por medida**: 1-4 en la página 1 y 5-7 en la 2, sin importar su
longitud, y cada sección lleva `wrap={false}`.
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:258-259` y `:501`.

**QV-13.** **No hay estrategia común de desborde de texto largo.** Tres formatos
—Lab, Imagen y Escrito— no tienen ningún control, y el Escrito es el de texto
más variable. Ningún `textarea` de los 8 formularios impone `maxLength`.
`wrap={false}` presente en `src/lib/pdf/RecetaPdf.tsx:569` y `:608`,
`src/lib/pdf/PlanSuplementacionPdf.tsx:327`,
`src/lib/pdf/NotaHonorariosPdf.tsx:367`,
`src/lib/pdf/SolicitudInternamientoPdf.tsx:417` (ausente en `:463`),
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:501`; ausente en Lab, Imagen y
Escrito.

**QV-14.** La columna `#` de Lab e Imagen **renderiza un bullet y descarta el
índice**, mientras Receta y Suplementación imprimen el número. El encabezado
dice `#` en los cuatro.
Bullet en `src/lib/pdf/SolicitudLabPdf.tsx:213-215` y
`src/lib/pdf/SolicitudImagenPdf.tsx:242-244`;
número en `src/lib/pdf/RecetaPdf.tsx:572` y
`src/lib/pdf/PlanSuplementacionPdf.tsx:334`.

**QV-15.** El label "PACIENTE" de Honorarios está **partido por un salto de
línea dentro del JSX**, residuo de edición.
`src/lib/pdf/NotaHonorariosPdf.tsx:331-333`.

**QV-16.** Divergencias de estilo dentro del bloque de página supuestamente
idéntico: Internamiento reserva `paddingBottom: 42` y Honorarios usa
`fontSize: 9` de página; los otros seis usan 54 y 10.
`src/lib/pdf/SolicitudInternamientoPdf.tsx:46`,
`src/lib/pdf/NotaHonorariosPdf.tsx:54`.

**QV-17.** El default de color primario del renderer **no coincide con el del
resto del sistema**: si `medico` llega `null`, el PDF sale con un azul que no
existe en ninguna otra parte de la app.
`src/lib/pdf/PdfStyles.tsx:77` (`#004A99`) vs.
`src/app/api/me/perfil-medico/route.ts:21`,
`src/components/documentos/RecetaForm.tsx:260`,
`src/app/r/[folio]/page.tsx:47`, `src/lib/offline/doctorProfile.ts:109`
(`#1a3a5c`).

**QV-18.** Las cuatro implementaciones del bloque de firma divergen en tamaño,
color de línea, tipografía y presencia del texto "Firma y sello": el
Consentimiento es el único que **no lo imprime**.
`src/lib/pdf/PdfFirma.tsx:53-58`, `src/lib/pdf/RecetaPdf.tsx:224-229`,
`src/lib/pdf/SolicitudInternamientoPdf.tsx:253-258`, ausente en
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:126-140`.

---

### Nivel 3 — Deuda estructural

**DE-01.** ~24 % del código de los 8 renderers es duplicación directa (≈937 de
3 830 líneas), y sube a ~40-45 % si se cuenta la redeclaración completa de
escalas y paletas. Metodología y desglose en §2.7.

**DE-02.** El bloque `page/headerFixed/headerInner/footerFixed` se declara
textualmente idéntico en los 8 archivos, y el JSX de header, footer y marca de
agua se repite **14 veces**.
`src/lib/pdf/RecetaPdf.tsx:258-281`, `SolicitudLabPdf.tsx:40-63`,
`SolicitudImagenPdf.tsx:34-57`, `PlanSuplementacionPdf.tsx:49-72`,
`SolicitudInternamientoPdf.tsx:41-64`, `ConsentimientoInformadoPdf.tsx:262-285`,
`EscritoMedicoPdf.tsx:401-424`, `NotaHonorariosPdf.tsx:52-75`.

**DE-03.** Cuatro implementaciones independientes del bloque de firma para el
mismo concepto.
`src/lib/pdf/PdfFirma.tsx:10-82`, `src/lib/pdf/RecetaPdf.tsx:187-248`,
`src/lib/pdf/SolicitudInternamientoPdf.tsx:417-431`,
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:87-141`.

**DE-04.** Cinco implementaciones independientes del recuadro etiqueta+valor y
cinco de tabla, sin ningún componente compartido.
Detalle en §2.4 y §2.5.

**DE-05.** No existe escala tipográfica ni de espaciado. Conteo sobre los 8
renderers más helpers: **16 tamaños de fuente distintos, 38 colores hex, 24
valores de padding, 20 de margin, 9 grosores de borde, 9 radios, 7
letter-spacings, 9 line-heights**. Todos literales en el sitio de uso.
Detalle en §3.2. El sistema de tokens del proyecto
(`src/app/spinus-tokens.css`) no es alcanzable desde react-pdf.

**DE-06.** `baseStyles` existe pero solo lo usan parcialmente 5 de los 8
formatos; 4 de sus entradas —`page`, `contenido`, `tituloDoc`, `pageNumber`— no
las usa nadie.
`src/lib/pdf/PdfStyles.tsx:96-168`.

**DE-07.** Dos registros de fuentes distintos, en dos rutas de código, con
distinto número de caras (5 vs 4, falta BoldItalic en la de cliente). La misma
fuente está en el repositorio dos veces, en dos formatos: `public/fonts/*.ttf`
y 2.7 MB de Base64 en `src/lib/pdf/fonts.ts`.
`src/lib/pdf/PdfStyles.tsx:1-32` vs. `src/lib/pdfClientFallback.ts:15-25`.
**Cuál gana en runtime es NO DETERMINADO** (§3.4).

**DE-08.** Tres representaciones independientes de cada documento —PDF, visor y
correo— que leen el mismo `contenido` y divergen en qué campos muestran. El
visor no tiene rama para Internamiento; muestra campos que ningún formulario
escribe (`rfc_medico`, `rfc_paciente`).
`src/lib/pdf/*`, `src/components/expediente/ModalVisorDocumento.tsx:178-368`
(`:309-320` para los RFC),
`src/app/api/email/enviar-documento/route.ts:144-266`.

**DE-09.** Cuatro copias del mapa de etiquetas de tipo de documento, con
diferencias de redacción entre ellas.
`src/components/expediente/ModalDocumentos.tsx:18-41`,
`src/components/expediente/ModalVisorDocumento.tsx:10-31`,
`src/app/api/email/enviar-documento/route.ts:12-22`, y los `TABS` de
`src/app/(app)/expediente/[id]/documentos/page.tsx:30-39`.

**DE-10.** Ocho copias literales del bloque de ~20 líneas que lee el perfil
offline de `localStorage`, una por formulario.
`RecetaForm.tsx:144-165`, `SolicitudLabForm.tsx:44-65`,
`SolicitudImagenForm.tsx:33-54`, `SolicitudInternamientoForm.tsx:49-70`,
`PlanSuplementacionForm.tsx:179-200`, `ConsentimientoInformadoForm.tsx:94-115`,
`EscritoMedicoForm.tsx:90-111`, `NotaHonorariosForm.tsx:71-92`.

**DE-11.** Ruta server `POST /api/generar-pdf` **sin consumidores**: acepta
`medico`, `data` y `logoUrl` arbitrarios del body sin validación de esquema, y
no propaga `consultorio` a ningún renderer.
`src/app/api/generar-pdf/route.ts:30-39` y `:62-71`.

**DE-12.** Código muerto en los renderers: `CompactHeader` nunca invocado
—precisamente el componente que resolvería ML-01—, `baseStyles` importado sin
usar en Lab, `startIdx` recibido y descartado en Lab, rama `compact:false` de
`PdfHeader` inalcanzable, `asuntoText.color` sobrescrito siempre.
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:155-232`,
`src/lib/pdf/SolicitudLabPdf.tsx:6` y `:203`,
`src/lib/pdf/PdfHeader.tsx:42-43`, `src/lib/pdf/EscritoMedicoPdf.tsx:439`.

**DE-13.** El mecanismo de plantillas de Honorarios **está inoperante para
guardar** en la única ruta de UI existente: `resolvedClinicaId` siempre resuelve
`null` y `doSaveTemplate` aborta.
`src/components/documentos/NotaHonorariosForm.tsx:101-108` y `:217-220`;
montaje sin props en
`src/app/(app)/expediente/[id]/documentos/page.tsx:105`.

**DE-14.** El payload de plantillas **no está versionado** y `doApplyTemplate`
desestructura sin defensas: un `contenido` sin `lineas` lanza `TypeError` y
rompe el render, sin try/catch ni error boundary.
`src/components/documentos/NotaHonorariosForm.tsx:172-184`, `:179`.

**DE-15.** Las policies de `plantillas_honorarios` **no pasan por el gate de
suscripción** (`clinica_tiene_acceso()` / `clinica_no_suspendida()`), a
diferencia de las 7 tablas listadas en `CLAUDE.md`. Tampoco hay límite por plan.
`supabase_migration_plantillas_honorarios.sql:29-50`;
`supabase/baseline/07_rls_policies.sql:521-542`.

**DE-16.** `clinica_id` en `plantillas_honorarios` se almacena y se escribe pero
**ningún predicado ni query lo usa**: columna inerte. El índice
`(user_id, created_at DESC)` tampoco lo usa ninguna query, porque la lista
ordena por nombre.
`supabase_migration_plantillas_honorarios.sql:13`, `:25-26`;
`src/components/documentos/NotaHonorariosForm.tsx:157`.

**DE-17.** El patrón de borrador/confirmación de la nota médica —maduro y
candidato a reutilización— **vive entero dentro de un archivo de 1 944 líneas y
nada está extraído**: máquina de estados, metadatos, transiciones y textos son
locales.
`src/app/(app)/expediente/[id]/nueva-nota/page.tsx:85`, `:94-103`, `:113-117`,
`:1307-1338`.

**DE-18.** Dos columnas para el mismo concepto según el origen del archivo:
`pdf_url` para PDFs generados y `storage_path`/`storage_bucket` para uploads
clínicos, con un CHECK que solo exige que exista uno de los dos.
`supabase/baseline/02_tables.sql:213`, `:216-217`, `:231-233`.

**DE-19.** Dos convenciones de partición de Storage en el mismo sistema:
`{pacienteId}/` en `documentos-pdf` y
`clinicas/{clinicaId}/pacientes/{pacienteId}/{uuid}.{ext}` en `labs-documentos`.
El segundo mecanismo es además más robusto —`upsert:false`, UUID en el path,
rollback transaccional—; el de los PDFs generados no tiene ninguno de los tres.
`src/lib/mobileShare.ts:228` vs. `src/lib/labs/upload-utils.ts:77-85` y
`src/components/labs/ModalSubirDocumento.tsx:200`, `:220-223`.

**DE-20.** Los uploads clínicos (`resultado_laboratorio`, `estudio_imagen`)
comparten tabla con los documentos generados y aparecen en el listado del
expediente, pero **no están en los mapas de etiqueta ni de color**: se muestran
con el `tipo` crudo y badge gris.
`src/components/expediente/ModalDocumentos.tsx:18-41` vs. el CHECK de tipos en
`supabase/baseline/02_tables.sql:223-230`.

**DE-21.** Comentarios que apuntan a un archivo inexistente: cuatro referencias a
"Duplicado de TabDocumentos.tsx — Fase 7 eliminará TabDocumentos", cuando
`TabDocumentos.tsx` ya no está en el repositorio.
`src/components/expediente/ModalDocumentos.tsx:17`, `:30`, `:81`, `:98`.

**DE-22.** `clinicas.color_primario` y `color_secundario` son `text` libre **sin
CHECK constraint**, y toda la derivación de color del sistema asume hex de 7
caracteres por concatenación de alfa.
`supabase/baseline/02_tables.sql:210-211`; derivaciones en §4.4.
**Comportamiento de react-pdf ante un color inválido: NO DETERMINADO.**

**DE-23.** El campo `email_consultorio` se declara en el tipo del PDF y se lee en
el footer, pero **ningún formulario lo pobla y el endpoint de perfil no lo
devuelve**: la banda del footer nunca imprime email.
`src/lib/pdf/PdfStyles.tsx:65`, `src/lib/pdf/PdfBarras.tsx:24`;
ausente en `src/app/api/me/perfil-medico/route.ts:57-76`.

**DE-24.** El nombre del médico ya viene compuesto en el payload
(`medico.nombre`) pero **los renderers lo ignoran y lo recomponen** desde las
partes en seis puntos distintos.
`src/lib/pdf/PdfHeader.tsx:22-27`, `src/lib/pdf/PdfFirma.tsx:11-16`,
`src/lib/pdf/RecetaPdf.tsx:188-193`,
`src/lib/pdf/SolicitudInternamientoPdf.tsx:266-271`,
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:249-254` y `:156-161`.

**DE-25.** El bypass de compresión de logo a ≤150 KB implica que un PNG pequeño
**nunca pasa por el canvas**: se sube con su resolución original, sin
normalizar, y llega así a los dos usos con dimensionados incompatibles (QV-06,
QV-07).
`src/lib/compressImage.ts:26`.

**DE-26.** El baseline de Storage **no reproduce el estado de seguridad real**:
las policies no se pudieron volcar y el propio archivo advierte que deben
recuperarse manualmente del dashboard. La fuente autoritativa son las
migraciones puntuales.
`supabase/baseline/09_storage_buckets.sql:43-49`.

**DE-27.** Documentación del proyecto desactualizada respecto al código, en dos
puntos verificados durante esta auditoría:
- `CLAUDE.md` § "Mejora B" describe el export de expediente como generado *"vía
  print dialog del navegador"* con footer `about:blank`; hoy usa
  `@react-pdf/renderer` y numera páginas
  (`src/components/expediente/ExportarExpedienteButton.tsx:115-123`,
  `src/lib/pdf/ExpedienteCompletoPdf.tsx:10`).
- `CLAUDE.md` § "Pendientes de seguridad · QW3" lista el endpoint ARCO como
  pendiente de restringir; ya está cerrado desde el 2026-07-31
  (`src/app/api/paciente/[id]/exportar/route.ts:20-46`).

---

## Índice de puntos NO DETERMINADOS

| # | Cuestión | Qué haría falta |
|---|---|---|
| 1 | Cuál de los dos registros de fuentes gana en runtime, y si Roboto-BoldItalic está disponible en cliente (§3.4) | Instrumentar `Font.getRegisteredFonts()` en un render real del navegador |
| 2 | Comportamiento de react-pdf ante un color inválido en `cp`/`cs` (§4.4) | Generar un PDF con un valor no-hex y observar |
| 3 | Si la marca de agua al 5 % desaparece o se convierte en manchón al imprimir en B/N (§5.3) | Depende del driver de impresión, no del código |
| 4 | Si existen plantillas de Honorarios guardadas en producción (§6.6) | `SELECT count(*) FROM plantillas_honorarios` |
| 5 | Si react-pdf deduplica el XObject de imagen cuando membrete y marca de agua comparten data URL (§8.9) | Inspeccionar el diccionario `/XObject` del PDF generado |
| 6 | Puntos exactos de solapamiento firma/footer en pt (§8.1) | Medir la altura renderizada de `BarraBottom` con la dirección real del médico |
| 7 | **Por qué la extracción del título falla en 3 formatos y no en los otros 3** (§8.5, QV-05) | `qpdf --qdf` sobre ambos grupos para comparar los `TJ` reales, y correr el mismo extractor sobre los 6 |
| 8 | Si `wrap={false}` sobre una fila que excede una página entera la parte o la desborda (§10.4) | Generar el caso límite y observar |
| 9 | Si la firma del Escrito Médico queda correctamente en la última página en documentos multipágina (§10.4) | Generar un escrito largo y observarlo |
| 10 | Valor efectivo de `Cache-Control` en `/r/[folio]` en producción (§11.5) | `curl -I` contra el despliegue |
| 11 | Conteo de documentos con QR emitidos en producción (§11.11) | Query a la base de producción |
| 12 | Si la sincronización offline revalida los campos obligatorios (§9.9) | Revisar `src/lib/offline/sync.ts`, no leído en esta auditoría |
| 13 | Algoritmo, origen y rotación de clave de `secureStorage` (§13.6) | Revisar `src/lib/secureStorage.ts`, no leído en esta auditoría |
| 14 | Si el versionado está activado a nivel de proyecto en Supabase Storage (§13.4) | Consultar la configuración de Storage en el dashboard |

---

**Fin de la auditoría.** Reconocimiento completado. Sin cambios en el código.
