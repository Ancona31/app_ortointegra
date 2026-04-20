# Auditoría de Assets del Búnker
Fecha: 2026-04-18
Generado para: Fase 0 del Cambio 2 (construcción de `bunker-app/` con Vite)

> Sesión de SOLO LECTURA. Ningún archivo del repo fue modificado, excepto la creación de este reporte. El objetivo fue mapear con precisión qué partes del repo principal van a copiarse o consultarse desde el búnker aislado.

---

## 1. Templates de PDF

Los 9 templates viven todos en `src/lib/pdf/` y comparten un patrón muy uniforme: todos importan helpers del mismo directorio (`./PdfHeader`, `./PdfFirma`, `./PdfWatermark`, `./PdfBarras`, `./PdfStyles`), usan `@react-pdf/renderer` y **no** tocan Supabase, hooks, ni contextos. Reciben `medico`, `data` y `logoUrl` como props planas.

| # | Template | Ruta | Imports autocontenidos | Imports acoplados |
|---|----------|------|------------------------|-------------------|
| 1 | Receta | `src/lib/pdf/RecetaPdf.tsx` | `@react-pdf/renderer`, `./PdfHeader`, `./PdfWatermark`, `./PdfBarras`, `./PdfStyles` (tipos + helpers `getPdfColors`, `contrastText`) | — ninguno — |
| 2 | Solicitud Lab | `src/lib/pdf/SolicitudLabPdf.tsx` | `@react-pdf/renderer`, `./PdfHeader`, `./PdfFirma`, `./PdfWatermark`, `./PdfBarras`, `./PdfStyles` | — |
| 3 | Solicitud Imagen | `src/lib/pdf/SolicitudImagenPdf.tsx` | idem | — |
| 4 | Plan Suplementación | `src/lib/pdf/PlanSuplementacionPdf.tsx` | idem | — |
| 5 | Nota Honorarios | `src/lib/pdf/NotaHonorariosPdf.tsx` | idem | — |
| 6 | Solicitud Internamiento | `src/lib/pdf/SolicitudInternamientoPdf.tsx` | idem | — |
| 7 | Escrito Médico | `src/lib/pdf/EscritoMedicoPdf.tsx` | idem + `react` (`ReactElement`) | — |
| 8 | Consentimiento Informado | `src/lib/pdf/ConsentimientoInformadoPdf.tsx` | idem + `@react-pdf/types` (`Style`), `react` (`ReactElement`) | — |
| 9 | Nota Evolución | `src/lib/pdf/NotaEvolucionPdf.tsx` | idem + `react` (`ReactElement`) | — |

Helpers compartidos dentro de `src/lib/pdf/`:

| Archivo | Propósito |
|---------|-----------|
| `PdfStyles.tsx` | Registro de fuentes Roboto (FS en server, URL en client), tipo `PdfMedicoData`, `PdfColors`, helpers `getPdfColors` y `contrastText`. **Defaultea colores a `#004A99` / `#1e5fa8`**. |
| `PdfHeader.tsx` | Membrete con logo, nombre, especialidad, cédulas, folio. |
| `PdfFirma.tsx` | Bloque de firma autógrafa + cédulas (usa `medico.firma_url` como `<Image>`). |
| `PdfBarras.tsx` | Barra superior (color cp+cs) y barra inferior con contacto del consultorio. |
| `PdfWatermark.tsx` | Marca de agua (logo al 5% opacidad, rotado). |
| `fonts.ts` | Contiene `ROBOTO_FONTS` en Base64 para registro client-side sin fetch de red. **Archivo enorme (~2.6 MB)** — no lo leí íntegro porque excede el límite del Read tool; confirmado por el `dynamic import` en `pdfClientFallback.ts`. |
| `header.ts` | Versión HTML del membrete (legacy `buildPdfHeader` + CSS para Puppeteer). **NO se usa en el flujo react-pdf actual** — se mantiene para `imprimirOCompartir` legacy. Importa `MedicoInfo` de `@/types`, por lo que **NO es autocontenido**. |
| `logo.ts` | Exporta `LOGO_BASE64` (logo default de Spinus en Base64). |

Orquestadores:

| Archivo | Rol |
|---------|-----|
| `src/lib/mobileShare.ts` | `generarPdf()` — selecciona el renderer por `tipo`, genera blob con `generatePdfClient`, sube a Storage bucket `documentos-pdf/{pacienteId}/{filename}.pdf` si hay red, y entrega al usuario (desktop: `<a download>`; móvil: `navigator.share`). También expone el legacy `imprimirOCompartir` (HTML). |
| `src/lib/pdfClientFallback.ts` | `generatePdfClient(element)` — registra fuentes Roboto Base64 (dynamic import de `fonts.ts`) y llama `pdf(element).toBlob()`. |
| `src/app/api/generar-pdf/route.ts` | API server-side que hace `renderToBuffer`. **Solo se usa en flujos server — el offline no lo necesita.** |

### Conclusión sección 1

Los 9 templates + `PdfStyles`, `PdfHeader`, `PdfFirma`, `PdfWatermark`, `PdfBarras`, `fonts.ts`, `logo.ts` son **100 % autocontenidos**: dependen únicamente de `@react-pdf/renderer`, `@react-pdf/types`, `react`. Se pueden copiar tal cual al búnker sin adaptación. **`header.ts` no es necesario para el búnker** (es del flujo HTML legacy). `mobileShare.ts` y `pdfClientFallback.ts` son copiables con ajustes menores (quitar el upload a Storage si el búnker lo hace por separado).

---

## 2. Assets del médico

**Hallazgo crítico arquitectónico:** los assets del médico viven en **DOS tablas distintas**. Esto no es obvio desde los templates, que reciben todo junto en `PdfMedicoData`.

### Dónde vive cada asset

| Asset | Tabla | Columna | Formato | Notas |
|-------|-------|---------|---------|-------|
| Nombre, título, cédulas, universidad, especialidad | `public.profiles` | `nombre`, `titulo`, `cedula_profesional`, `cedula_especialidad`, `universidad`, `especialidad` | TEXT | Por usuario. |
| Dirección y teléfono del consultorio | `public.profiles` | `direccion_consultorio`, `telefono_consultorio` | TEXT | Por usuario. Migración `supabase_migration_perfil_medico.sql`. |
| **Firma autógrafa** | `public.profiles` | `firma_url` | TEXT (storage path, **no URL**) | Formato: `{user_id}/firma.png` en bucket privado `firmas-medicos`. El cliente **nunca** accede directo: el endpoint `/api/me/perfil-medico` genera un signed URL de 1h vía service_role. Migración `supabase_migration_firma_medico.sql`. |
| **Logo de la clínica** | `public.clinicas` | `logo_url` | URL pública | Bucket `clinica-logos`, ruta `{clinica_id}/logo.{ext}`. Upload vía `/api/me/logo` (solo admin/super_admin). |
| **Colores personalizados** | `public.clinicas` | `color_primario`, `color_secundario` | TEXT hex | **Por clínica, NO por médico.** Todos los médicos de una clínica comparten la misma paleta. |
| Nombre display de la clínica | `public.clinicas` | `nombre_display`, `nombre` | TEXT | Fallback: `nombre_display` ?? `nombre`. |

**Defaults de color inconsistentes (ver Sección 6):** el endpoint `/api/me/perfil-medico` defaultea a `#1a3a5c` / `#1e5fa8`. `src/lib/pdf/PdfStyles.tsx` defaultea a `#004A99` / `#1e5fa8`. `header.ts` a `#1a3a5c` / `#1e5fa8`.

### Cómo los templates acceden a los assets

Los PDFs **no** hacen queries; reciben todo empaquetado en `PdfMedicoData` (definido en `src/lib/pdf/PdfStyles.tsx`):

```ts
interface PdfMedicoData {
  nombre, especialidad, cedula_profesional, cedula_especialidad,
  logo_url, firma_url,                 // URLs o Base64 data URLs
  color_primario, color_secundario,
  direccion_consultorio, telefono_consultorio, email_consultorio,
}
```

Flujo actual en la app online:
1. `useMedicoInfo` (SWR) → `GET /api/me/perfil-medico`.
2. El endpoint compone los datos leyendo `profiles` + `clinicas` y genera un signed URL para la firma.
3. Los formularios pasan el objeto al template vía `generarPdf(tipo, medico, data, logoUrl)`.

### Espejo offline — YA EXISTE Y ESTÁ VIVO

`src/lib/offline/doctorProfile.ts` ya pre-sincroniza el perfil completo a `localStorage.spinus_doctor_profile`:
- Logo y firma convertidos a **Base64 data URL** (vía `fetch` + `FileReader.readAsDataURL`).
- Se dispara desde `useMedicoInfo.onSuccess` y desde `perfil/page` al guardar.
- Expone `getDoctorProfile()` y `syncDoctorProfile()`.
- Formato persistido (`DoctorProfile`): incluye colores, nombres, cédulas, universidad, contacto y ambos Base64.

**Esto es el puente natural con el búnker.** El búnker debería leer `spinus_doctor_profile` de `localStorage`, no implementar su propia sincronización. Tanto el archivo como la key ya están decididos.

---

## 3. Estructura de documentos en Supabase

### Tabla `public.documentos`

Definida en `supabase_schema.sql` (líneas 58–67) y modificada por varias migraciones:

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | default `uuid_generate_v4()` |
| `paciente_id` | uuid FK → `pacientes(id)` **ON DELETE RESTRICT** | cambiado de CASCADE por `supabase_migration_retencion_expedientes.sql` (cumplimiento NOM-004). |
| `consulta_id` | uuid FK → `consultas(id)` ON DELETE SET NULL | nullable. |
| `tipo` | TEXT CHECK | Valores actuales (tras última migración `supabase_migration_nota_honorarios.sql`): `receta`, `solicitud_lab`, `solicitud_imagen`, `informe_clinico`, `plan_suplementacion`, `escrito_medico`, `solicitud_internamiento`, `consentimiento_informado`, `nota_honorarios`. **Nota: `nota_evolucion` NO está en este check** — las notas de evolución se guardan en la tabla `consultas`, no en `documentos`. |
| `contenido` | JSONB | payload completo del formulario. Forma definida por `DocumentoContenido` en `src/types/index.ts` (flexible, un unión de campos por tipo). |
| `pdf_url` | TEXT | nullable — storage path si el PDF se subió. |
| `client_id` | TEXT UNIQUE partial | Agregado por `supabase_migration_client_id_idempotency.sql`. UUID v4 o folio generado por el cliente, base de idempotencia para reintentos del outbox (aunque ese outbox ya murió, la columna sigue viva). |
| `created_at` | timestamptz default now() | |

**Observación:** la columna `medico_id` **NO existe** en `documentos`. La identidad del médico se deriva implícitamente vía `paciente.clinica_id` → RLS. Si el búnker necesita distinguir cuál médico firmó, tendrá que apoyarse en `consulta_id` (si existe) o agregar ese campo más adelante.

### Políticas RLS (schema.sql líneas 117–124)

Las cuatro operaciones (SELECT/INSERT/UPDATE/DELETE) usan la misma regla:

```sql
exists (
  select 1 from pacientes p
  where p.id = documentos.paciente_id
    and p.clinica_id = public.get_clinica_id()
)
```

Es decir: heredan el filtro de clínica a través del paciente. El búnker, si sube documentos con el JWT del médico, respetará automáticamente estas RLS.

### Storage bucket `documentos-pdf`

- Definido en `supabase_schema.sql` (línea 128): privado.
- Policies en `supabase_migration_storage_documentos_pdf.sql` (2026-04-16): cualquier usuario `authenticated` puede INSERT/SELECT/DELETE. **No hay filtro por clínica en las policies del bucket** — el aislamiento depende del nombre de la ruta (`{paciente_id}/{filename}.pdf`) y de que el paciente_id mismo esté protegido por RLS en su tabla. (Ver Sección 6.)
- Estructura de ruta: `{paciente_id}/{filename}.pdf`.
- Escritura desde cliente: `src/lib/mobileShare.ts` línea 210–218.

### Bucket `firmas-medicos` (secundario, también del médico)

- Privado, sin policies en el bucket.
- Ruta `{user_id}/firma.png`.
- Acceso 100 % server-side con service_role (ver `src/app/api/me/firma/route.ts` y `/api/me/perfil-medico`). El búnker **no** puede tocar este bucket directamente — tiene que consumir la firma ya convertida a Base64 desde `spinus_doctor_profile`.

### Endpoint `POST /api/documentos`

`src/app/api/documentos/route.ts` — inserta en la tabla `documentos`. Espera body `{ tipo, contenido, client_id?, paciente_id? }`. Implementa idempotencia: si llega un `client_id` ya existente, devuelve el id sin duplicar.

---

## 4. Formularios actuales

Los **8 formularios de documentos** viven en `src/components/documentos/`. El **9° (nota de evolución)** no es un componente aislado: vive incrustado en `src/app/(app)/expediente/[id]/nueva-nota/page.tsx` (una página de **1266 líneas** que combina nota clínica + atajo a los otros 8).

| # | Tipo | Ruta | Líneas | react-hook-form / zod | Dependencias compartidas | Dependencias particulares |
|---|------|------|--------|-----------------------|--------------------------|---------------------------|
| 1 | Receta | `src/components/documentos/RecetaForm.tsx` | 535 | No — `useState` manual | (ver abajo) | `qrcode`, `@/components/AutocompleteMedicamento`, `@/data/medicamentos`, `@/hooks/useProfile`, `Medicamento` de `@/types` |
| 2 | Solicitud Lab | `src/components/documentos/SolicitudLabForm.tsx` | 247 | No | (ver abajo) | `@/components/AutocompleteEstudio` |
| 3 | Solicitud Imagen | `src/components/documentos/SolicitudImagenForm.tsx` | 232 | No | (ver abajo) | — |
| 4 | Plan Suplementación | `src/components/documentos/PlanSuplementacionForm.tsx` | 524 | No | (ver abajo) | `qrcode`, `@/hooks/useProfile` |
| 5 | Nota Honorarios | `src/components/documentos/NotaHonorariosForm.tsx` | 823 | No | (ver abajo) | `@/components/ui/Portal`, `AseguradoraInfo`/`HonorariosTemplate` de `@/types` |
| 6 | Solicitud Internamiento | `src/components/documentos/SolicitudInternamientoForm.tsx` | 379 | No | (ver abajo) | — |
| 7 | Escrito Médico | `src/components/documentos/EscritoMedicoForm.tsx` | 283 | No | (ver abajo) | `dompurify` (sanitiza HTML del editor WYSIWYG) |
| 8 | Consentimiento Informado | `src/components/documentos/ConsentimientoInformadoForm.tsx` | 421 | No | (ver abajo) | — |
| 9 | Nota de Evolución | `src/app/(app)/expediente/[id]/nueva-nota/page.tsx` | **1266** | No | `createClient`, `Portal`, `secureStorage`, `useAuditAccess`, `CIE10Combobox`, `Breadcrumbs`, `imprimirOCompartir`, `calcularEdad` | **NO es un componente reusable** — es una página entera con UI embebida. |

### Dependencias compartidas entre los 8 formularios de `src/components/documentos/`

Todos (8 de 8) importan el mismo bloque:

```
@/lib/patientUtils          → generateDocFileName (utilidad pura)
@/hooks/useMedicoInfo       → hook SWR que lee /api/me/perfil-medico + cache offline
@/lib/mobileShare           → generarPdf (orquestador del PDF)
@/components/ui/Toast       → useToast
@/lib/supabase/client       → createClient (cliente Supabase)
date-fns + date-fns/locale  → format, es
lucide-react                → iconos
react / react-dom           → useState, flushSync, etc.
```

Salvo `flushSync` (usado para forzar render antes del PDF) y `createClient`, no hay lógica compartida entre formularios más allá de los hooks listados.

### Validación

Ninguno usa zod ni react-hook-form. La validación es manual, inline con `useState` y checks condicionales antes de `generarPdf`. **Esto es bueno para el búnker** (menos dependencias que empaquetar) y **malo para la robustez** (ver Sección 6).

### Hooks relevantes

- `src/hooks/useMedicoInfo.ts` — 57 líneas. SWR a `/api/me/perfil-medico` + fallback a `secureStorage.cache_medico_info` + `syncDoctorProfile` al offline. Depende de `@/lib/secureStorage` y `@/lib/offline/doctorProfile`.
- `src/hooks/useProfile.ts` — 122 líneas. Lee `profiles.*` con timeout de 3s y fallback a `secureStorage.cache_user_profile`. Usado por `RecetaForm` y `PlanSuplementacionForm` únicamente (aparentemente redundante con `useMedicoInfo` en esos formularios).

---

## 5. Recomendaciones para Fase B (copiar componentes al búnker)

### Se puede copiar tal cual (sin adaptación)

- `src/lib/pdf/RecetaPdf.tsx`, `SolicitudLabPdf.tsx`, `SolicitudImagenPdf.tsx`, `PlanSuplementacionPdf.tsx`, `NotaHonorariosPdf.tsx`, `SolicitudInternamientoPdf.tsx`, `EscritoMedicoPdf.tsx`, `ConsentimientoInformadoPdf.tsx`, `NotaEvolucionPdf.tsx`.
- `src/lib/pdf/PdfStyles.tsx` — incluye `PdfMedicoData`, `getPdfColors`, `contrastText`, `baseStyles`.
- `src/lib/pdf/PdfHeader.tsx`, `PdfFirma.tsx`, `PdfWatermark.tsx`, `PdfBarras.tsx`.
- `src/lib/pdf/fonts.ts`, `logo.ts` (assets Base64 ya embebidos).
- `src/lib/pdfClientFallback.ts` (el `generatePdfClient` es puro cliente).

Ninguno de estos toca Supabase, hooks de la app, ni contextos React específicos de Next.js. Vite los compilará sin ajustes.

### Requiere adaptación ligera

- `src/lib/mobileShare.ts` → quitar el upload a Storage (fases 5 del flujo) del código que copies al búnker. El búnker sube los PDFs a través de su propia cola de sync, no desde `generarPdf` directamente. Alternativa: pasar una prop `uploadFn` opcional.
- `src/lib/patientUtils.ts` (`generateDocFileName`, `calcularEdad`) — no lo leí en esta auditoría porque estaría fuera de scope acordado, pero por su nombre debería ser puro. **Verificar antes de copiar.**

### Requiere reescritura completa en el búnker

- Los **8 formularios** de `src/components/documentos/`. Son copiables en ~80 % pero tienen acoplamientos que no viven en el búnker:
  - `useMedicoInfo` (SWR + `/api/me/perfil-medico`) → reemplazar por una lectura directa de `localStorage.spinus_doctor_profile`.
  - `createClient()` de Supabase → el búnker no debería tocar Supabase en vivo. Las escrituras van a una cola local (IndexedDB/localStorage) que `src/lib/offline/sync.ts` o un sustituto drenará cuando vuelva la red.
  - `useToast` → decisión UI del búnker (¿sistema propio o copiar el existente?).
  - `dompurify` (EscritoMedico), `qrcode` (Receta, PlanSup), `AutocompleteMedicamento`/`AutocompleteEstudio` → evaluar caso por caso. `AutocompleteMedicamento` depende de `@/data/medicamentos` (un dataset estático embebido; verificar tamaño antes de copiar).
- **La nota de evolución no tiene un componente aislado.** Hay que **extraerlo** de `nueva-nota/page.tsx` (1266 líneas, con mucha lógica mezclada: breadcrumbs, audit, CIE10, dinámicos de los otros formularios). Esto es trabajo no trivial.

### Assets del médico en el búnker — patrón recomendado

El puente natural ya existe: `localStorage.spinus_doctor_profile` (gestionado por `src/lib/offline/doctorProfile.ts`). El búnker **solo debe consumir**, nunca sincronizar — la app online es quien lo mantiene actualizado. El formato `DoctorProfile` incluye `logo_base64`, `firma_base64`, colores, nombres, cédulas, contacto — todo lo que `PdfMedicoData` necesita. Mapear un objeto al otro es trivial.

### Imports a resolver al copiar

- `@/types` → varios formularios importan `Medicamento`, `MedicoInfo`, `AseguradoraInfo`, `HonorariosTemplate`. Habrá que copiar los tipos estrictamente necesarios a `bunker-app/src/types/`.
- `@/lib/logger.ts` → CLAUDE.md lo menciona como estándar, pero ninguno de los archivos leídos lo importa. Verificar antes de asumirlo obligatorio en el búnker.
- `@/lib/secureStorage` → lo usa `useMedicoInfo` y `useProfile`. **El búnker probablemente NO necesita cifrado AES-256 en el perfil del médico** (son datos públicos del médico, no del paciente). Evaluar si vale la pena copiar `secureStorage` o usar `localStorage` plano dado que los datos no son PII de paciente.

---

## 6. Incógnitas / riesgos detectados

Reportados con honestidad, sin endulzar. Son cosas que vi y requieren decisión del usuario antes de empezar Fase A.

### Riesgos altos

1. **`nota_evolucion` no existe como componente reusable.** Está fusionada en `src/app/(app)/expediente/[id]/nueva-nota/page.tsx` (1266 líneas). Para el búnker hay que **extraer** la UI de nota, sus estados, su autosave y su integración con la tabla `consultas` (no con `documentos`). Esta es la pieza más cara del plan. Decide si el búnker v1 realmente necesita nota de evolución o puede limitarse a los 8 documentos y dejar la nota para v2.

2. **`nota_evolucion` se guarda en `consultas`, no en `documentos`.** El `check constraint` actual de `documentos.tipo` NO incluye `nota_evolucion` (sólo lo tienen `receta`, `solicitud_lab`, `solicitud_imagen`, `informe_clinico`, `plan_suplementacion`, `escrito_medico`, `solicitud_internamiento`, `consentimiento_informado`, `nota_honorarios`). Si el búnker quiere encolar una nota offline, tiene que encolar un INSERT a `consultas` con payload distinto al de `documentos`. Esto rompe la idea de "una sola cola homogénea de documentos".

3. **Los colores se guardan en `clinicas`, no en `profiles`.** Esto significa que:
   - Todos los médicos de una misma clínica comparten paleta.
   - Si en el futuro quieren colores por médico, hay que agregar columnas en `profiles` y resolver un fallback.
   - **El búnker NO tiene problema hoy** porque `syncDoctorProfile` ya traslada los colores al localStorage, pero queda documentado para que no sorprenda.

4. **Defaults de color inconsistentes.** `/api/me/perfil-medico` usa `#1a3a5c` / `#1e5fa8`. `PdfStyles.getPdfColors` usa `#004A99` / `#1e5fa8`. Si un médico no tiene clínica con colores configurados, el PDF se ve distinto dependiendo del path que use. No es bloqueante, pero es un bug latente que el búnker podría heredar.

5. **Policies del bucket `documentos-pdf` no filtran por clínica.** Cualquier usuario autenticado puede `SELECT` / `DELETE` cualquier archivo del bucket (ver `supabase_migration_storage_documentos_pdf.sql`). El aislamiento depende de que nadie adivine el `paciente_id` UUID + filename. **Esto no es del alcance del búnker**, pero si la Fase B agrega más assets al bucket desde el cliente, el riesgo se amplifica. Recomiendo endurecer estas policies independientemente del búnker.

### Riesgos medios

6. **Los 8 formularios no validan con zod ni con schemas formales.** Validación ad-hoc con `useState`. Significa que si el búnker reusa el mismo patrón, los tests serán difíciles y un typo en `contenido` se detectará sólo cuando el server reject o el PDF se renderice mal. Antes de copiar, considera introducir zod en los tipos `DocumentoContenido` — es un buen momento para hacerlo porque la Fase A parte de cero en `bunker-app/`.

7. **`RecetaForm` y `PlanSuplementacionForm` importan tanto `useMedicoInfo` como `useProfile`** — aparente redundancia. No verifiqué si el uso es legítimo (distintos campos en distinto timing) o accidental. Si el búnker copia estos formularios, hay que decidir cuál de las dos fuentes usar. Señal de olor.

8. **`fonts.ts` pesa ~2.6 MB** (Base64 de 4 variantes de Roboto). Bundeado al búnker, infla el JS inicial. Opciones: (a) lazy-load al primer uso de PDF (como ya hace `pdfClientFallback.ts`), (b) servir los TTF desde `/fonts/` en el dominio del búnker y registrarlos por URL (perdería la garantía offline si los TTF no están en el Service Worker cache). La v1 del búnker debe elegir explícitamente.

9. **Offline doctor profile está sincronizado pero nadie garantiza que exista antes del primer uso offline.** Si un médico instala el búnker y entra en modo offline antes de que `useMedicoInfo` haya corrido con éxito al menos una vez online, `spinus_doctor_profile` estará vacío y los PDFs saldrán sin logo/firma/colores. La app debería bloquear la entrada al búnker si `getDoctorProfile()` devuelve `null`, o forzar un warm-up. No vi esta salvaguarda en el código leído.

### Incógnitas que no cierro en esta auditoría

10. **No leí `src/lib/patientUtils.ts`** (fuera del scope acordado). Todos los formularios importan `generateDocFileName` de ahí y `nueva-nota/page.tsx` importa `calcularEdad`. Antes de la Fase B conviene confirmar que son funciones puras sin dependencias externas.

11. **No leí `src/data/medicamentos.ts`** (fuente de `AutocompleteMedicamento`). Si es un dataset estático grande, decidir si se bundlea en el búnker o se limita el autocomplete al offline.

12. **No leí el interior completo de los formularios** (~3,444 líneas totales entre los 8). Copiarlos literalmente al búnker asumiendo que solo hay que reemplazar `useMedicoInfo` y `createClient` es optimista. Pueden tener llamadas directas a `supabase.from('…')` dentro del `handleSubmit` que no aparecieron en los primeros 40 renglones de imports. Recomiendo un pase de verificación más fino por formulario antes de Fase B, o mejor, tratarlos como referencia visual y reescribir su lógica con el patrón del búnker.

13. **El constraint `documentos.tipo` ha sido re-declarado en múltiples migraciones sucesivas** (`internamiento`, `escrito_medico`, `consentimiento`, `nota_honorarios`) usando `DROP + ADD` cada una. Funciona si se aplican en orden, pero la migración vigente es la última aplicada. Si hay un entorno que no aplicó `supabase_migration_nota_honorarios.sql`, la tabla rechazará inserts de `nota_honorarios`. Verificar estado en producción antes de asumir el check más permisivo.
