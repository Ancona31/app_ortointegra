# NOMBRES_PLAN.md — Normalización de nombres de médicos en `profiles`

> Plan operativo. Estrategia: **expand/contract** (cambio en paralelo). Agregar lo nuevo,
> migrar manteniendo lo legacy vivo, y contraer (DROP de `nombre`) en un proyecto futuro y
> separado. Protocolo D-T6 aplica desde la Fase 1 (Fase 0 ya completada, read-only).

---

## Decisiones congeladas (no re-litigar)

1. Solo se normaliza `profiles`. La tabla `pacientes` **no se toca** en este proyecto.
2. Esquema objetivo: conservar `titulo` (ya existe) + agregar `nombres`, `apellido_paterno`,
   `apellido_materno` (este último siempre **NULLABLE**).
3. Migración **aditiva**. La columna legacy `nombre` se **mantiene viva** durante toda la
   transición. El DROP es un paso futuro y separado (Fase 6, fuera de alcance aquí).
4. Backfill = **sugerencia inicial**, no fuente de verdad. Cada médico confirma/corrige en su perfil.
5. `apellido_materno` siempre nullable (extranjeros, apellido único, compuestos).

---

## Hechos verificados (Fase 0 — inventario read-only)

**Estructura.** `profiles.nombre` = text NULLABLE sin default (`supabase/baseline/02_tables.sql:401`);
`profiles.titulo` = text NULLABLE default `'Dr.'` (`:406`). `role` NOT NULL default `'medico'` (`:400`).
`es_admin_de_clinica` boolean NOT NULL default false añadida en
`supabase/migrations/20260518083036_etapa1_schema_declarativo.sql:41-42`. No hay tipos generados;
contrato manual en `src/hooks/useProfile.ts:17-30`.

**Trigger protector = DENYLIST de 3 columnas.** `proteger_columnas_sensibles_profiles()`
(`supabase/migrations/20260602_sec_proteger_columnas_sensibles_profiles.sql:53-79`, BEFORE UPDATE)
solo bloquea cambios a `role`, `clinica_id`, `es_admin_de_clinica` (`:63-71`). Exento cuando
`auth.uid() IS NULL` (service_role/migraciones). **Las columnas nuevas NO chocan con el trigger;
no se modifica el trigger en este proyecto.**

**RLS.** `profiles_update` permite al médico escribir su propia fila (id = auth.uid()) o al admin
sobre su clínica (`...etapa5j_paso2_policies_profiles_invitaciones.sql:184-196`). `nombre` y `titulo`
**ya son editables hoy** por el propio médico. No se requieren cambios de RLS para Fases 1–5.

**Composición de nombre.** Único punto de composición online:
`src/app/api/me/perfil-medico/route.ts:38` → `${titulo} ${nombre}`.trim(); el campo `medico.nombre`
devuelto ya lleva el título. Composición duplicada en otros 3 sitios:
`src/app/api/consultas/route.ts:123` (snapshot `consultas.medico_nombre`),
`src/app/api/consultas/[id]/addendum/route.ts:80` (snapshot `addendums.medico_nombre`),
`src/app/api/email/enviar-documento/route.ts:108`.

**PDFs / firma legal** leen `medico.nombre` ya compuesto (sin `titulo` separado):
`src/lib/pdf/PdfFirma.tsx`, `PdfHeader.tsx`, `header.ts`; contratos de tipo sin `titulo`:
`src/types/index.ts:76-90` (MedicoInfo), `src/lib/pdf/PdfStyles.tsx:50` (PdfMedicoData).
Espejo offline: `src/lib/offline/doctorProfile.ts`.

**Snapshots inmutables (NOM-004).** `consultas.medico_nombre`, `addendums.medico_nombre`,
recetas `medico_nombre` — congelados, valor jurídico. El backfill NO los toca.

**Orden / búsqueda.** `.order('nombre')` en `src/app/api/clinica/medicos/route.ts:22` y
`src/app/(app)/dashboard/AsistenteDashboard.tsx:63-64`; `.ilike('nombre')` en
`src/app/api/super-admin/dashboard/usuarios/route.ts:96`. **No existe orden por apellido.**

**Form "Mi Perfil".** `src/app/(app)/perfil/page.tsx`. El campo `nombre` NO se edita hoy
(solo se muestra read-only en el preview de membrete `:386`). PUT a
`src/app/api/me/perfil-medico/route.ts:69-87` escribe directo a `profiles` **sin validación
server-side ni allowlist** (solo valida auth).

**`paciente_medico` SELECT.** Un médico no-admin solo lee su propio vínculo
(`medico_id = auth.uid()`); el admin ve los de su clínica
(`...20260524_etapa5e_bd2_policies_paciente_medico.sql:28-34`).

---

## Orden duro de ejecución
[Fase 0 OK]  ->  Fase 1  ->  Fase 2  ->  Fase 3  ->  Fase 4  ->  Fase 5   (Fase 6 = futuro)
(inventario)     (schema)    (backfill) (perfil)   (helper)    (endpoint)

---

## Fase 1 — Migración aditiva de esquema

- ALTER aditivo a `profiles`: `nombres` (text, NULLABLE), `apellido_paterno` (text, NULLABLE),
  `apellido_materno` (text, NULLABLE), `nombre_confirmado` (boolean NOT NULL DEFAULT false).
- Las columnas de nombre entran NULLABLE: filas existentes no tienen valor y la tabla está endurecida.
- La obligatoriedad de `nombres` / `apellido_paterno` se aplica en validación (Fase 3), no como
  NOT NULL de columna.
- `titulo` y `nombre` intactos.
- Bajo D-T6: una query a la vez, validación con Angel, smoke test.

---

## Fase 2 — Backfill como sugerencia

- Parsear `nombre` -> columnas nuevas con heurística de nombre mexicano (últimos dos tokens =
  apellidos como propuesta). Explícitamente propuesta, no verdad.
- Deja `nombre_confirmado = false` en todas las filas backfilleadas.
- NO toca snapshots NOM-004. Ejecutado con rol elevado (exento del trigger por `auth.uid() NULL`).
- `nombre` legacy permanece intacto y sigue siendo la fuente de display.

---

## Fase 3 — Form "Mi Perfil" + confirmación + DUAL-WRITE + validación server-side

- Exponer `nombres`, `apellido_paterno`, `apellido_materno` en el form para que cada médico
  confirme/corrija. Validación: `nombres` + `apellido_paterno` obligatorios; `apellido_materno` opcional.
- **DUAL-WRITE (decisión clave):** al guardar, escribir las columnas nuevas Y recomponer `nombre`
  legacy desde ellas, conservando su semántica actual (nombre completo, sin título). Así
  `nombre` sigue siendo válido y **ningún punto de composición / PDF / firma legal / snapshot
  se toca en este proyecto**. Marcar `nombre_confirmado = true` al confirmar.
- **Cerrar la brecha de validación server-side (deuda detectada):** el PUT
  `src/app/api/me/perfil-medico/route.ts:69-87` escribe directo sin allowlist. Antes de exponer
  los campos nuevos, añadir una allowlist explícita de columnas editables, o cualquier campo del
  body entra a `profiles`.
- RLS y trigger ya permiten esta escritura (ver Hechos verificados); no se modifican.

---

## Fase 4 — Helper de nombre corto (NO migración masiva)

- Los puntos de lectura existentes **se quedan con `nombre`** (gracias al dual-write siguen correctos).
- Solo se AGREGA un helper centralizado para el rediseño de UI:
  - `nombreCorto` = `titulo` + `apellido_paterno` -> "Dr. Ancona", **solo si `nombre_confirmado = true`**;
    si no, fallback a `nombre` legacy.
  - `nombreCompleto` con fallback a `nombre`.
- Este proyecto deja el modelo + el helper listos; el rediseño de UI los consume después.

---

## Fase 5 — Endpoint `/api/clinica/medicos` + orden por apellido

- Ampliar el SELECT (hoy `id, nombre, titulo, especialidad`, `route.ts:19`) para incluir
  `apellido_paterno`, `apellido_materno`, `nombres`, `nombre_confirmado`.
- Migrar `.order('nombre')` -> `.order('apellido_paterno')` cuando los datos estén confirmados
  (afecta `clinica/medicos/route.ts:22` y `AsistenteDashboard.tsx:63-64`). Considerar índice.
- Actualizar consumidores: `QuickPatientModal.tsx`, `pacientes/nuevo/page.tsx`, `agenda/page.tsx`.

---

## Fuera de alcance

- **Fase 6 — DROP de `nombre`** (proyecto futuro y separado). Gate: 100% de médicos con
  `nombre_confirmado = true` + cero puntos de lectura dependiendo de `nombre`. Requiere antes
  consolidar la composición duplicada y los contratos de tipo (ver Deuda).
- Normalización de nombres en `pacientes` (decisión congelada #1).

---

## Deuda a registrar en DEUDA_TECNICA.md (no se resuelve aquí)

- Composición `titulo + nombre` duplicada en 4 sitios (`perfil-medico:38`, `consultas:123`,
  `addendum:80`, `email:108`) — consolidar antes del DROP de Fase 6.
- Contratos `MedicoInfo` (`types/index.ts:76-90`) y `PdfMedicoData` (`PdfStyles.tsx:50`) asumen
  `nombre`-con-título embebido, sin `titulo` separado — trabajo de Fase 6.

---

## Decisiones de diseño (resueltas por el inventario)

- Trigger protector: DENYLIST de 3 columnas; las nuevas no chocan. No se toca el trigger.
- RLS de UPDATE: el médico ya puede auto-editar su fila. No se toca la RLS.
- `nombre` legacy: **dual-write** (se recompone desde las columnas nuevas), NO se congela.
  Mantiene viva toda la cadena PDF/firma/snapshot sin cambios.
- `nombre_confirmado boolean DEFAULT false`: adoptado. Gatea el helper de nombre corto y el DROP futuro.

---

## Protocolos

- **Desde Fase 1: Protocolo D-T6.** Una query a la vez vía SQL Editor (nunca CLI), validación
  con Angel antes de la siguiente, stop + mitigación ante resultado inesperado, smoke test tras
  cada cambio, luego validación a nivel app. Producción — los errores son fatales.
- Claude Code: investigador read-only / propone diffs y se detiene; nunca git. Angel corre
  tsc/lint/git y commitea manualmente.
- Deuda transversal -> `DEUDA_TECNICA.md`. Deuda acotada a un sub-paso -> "Fuera de alcance" de este plan.
