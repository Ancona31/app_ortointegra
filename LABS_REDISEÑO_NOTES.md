# LABS_REDISEÑO_NOTES.md

Notas vivas del rediseño del sistema de laboratorios. Se actualiza por sub-fase.

## Estado por sub-fase

| # | Sub-fase | Estado | Commit |
|---|---|---|---|
| 0 | Cleanup y deuda técnica | ✅ Cerrada en 2026-04-21 | pendiente (Angel hace commit manual) |
| 1A | Schema SQL: tablas + RLS + trigger | ✅ Cerrada 2026-04-21 | pendiente (Angel hace commit manual) |
| 1B | Seed del catálogo de analitos | ✅ Cerrada 2026-04-21 (175 analitos) | pendiente (Angel hace commit manual) |
| 2 | Página base + Hero + secciones vacías | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 3 | Modal "Agregar medición" + autocomplete + custom | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 4 | Dropdown selector + detail header + tabla | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 5 | Gráfica con bandas + tendencia + leyenda | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 6A | Integración Documentos — migración SQL uploads | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 6B | Integración Documentos — componentes UI | ⏳ Pendiente | — |
| 7 | Card "Mediciones y Documentos" en ExpedienteCardsGrid | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 8 | Migración /estado + drop tabla legacy | ⏳ Pendiente | — |
| 9 | QA end-to-end + validaciones manuales | ⏳ Pendiente | — |

## Consumidores de useLaboratoriosNormalizados (sub-fase 8)

Resultado del grep ejecutado en sub-fase 0:

- `src/app/(app)/expediente/[id]/page.tsx:8,45` — único consumidor externo

Conclusión: sub-fase 8 puede proceder tal como está planeada respecto a este hook.

## Consumidores de la tabla `laboratorios` legacy (sub-fase 8)

Resultado del grep `from.*laboratorios` en `src/`:

1. **src/app/(app)/expediente/[id]/page.tsx** — vía `useLaboratoriosNormalizados`. Migrar al nuevo modelo en sub-fase 8.
2. **src/app/api/paciente/[id]/exportar/route.ts:46** — ⚠️ HALLAZGO NO PREVISTO EN EL PLAN ORIGINAL. Exporta expediente leyendo de tabla `laboratorios`. Producción-crítico. Migrar al nuevo modelo ANTES del DROP TABLE, no después.
3. **src/app/(app)/expediente/[id]/laboratorios/[labId]/page.tsx** — página detalle legacy. ELIMINAR en sub-fase 8.
4. **src/app/(app)/expediente/[id]/laboratorios/nuevo/page.tsx** — página de alta legacy. ELIMINAR en sub-fase 8.
5. **src/app/api/laboratorios/route.ts** — API POST legacy. ELIMINAR en sub-fase 8.
6. **src/app/api/laboratorios/[id]/route.ts** — API DELETE legacy. ELIMINAR en sub-fase 8.
7. **src/app/(app)/laboratorios/page.tsx** (15665 bytes, Apr 7) — ⚠️ HALLAZGO ADICIONAL no detectado en sub-fase 0. Ruta standalone de laboratorios (no dentro del expediente). Revisar en sub-fase 8 para determinar si debe ELIMINARSE completa o MIGRARSE al nuevo modelo. El contenido de este archivo debe inspeccionarse al arrancar sub-fase 8 para decidir.

NOTA: no existe `src/app/(app)/expediente/[id]/laboratorios/page.tsx` (la ruta raíz vieja). Solo hay subrutas `/nuevo` y `/[labId]`. Ventaja para sub-fase 2: crear el nuevo `page.tsx` raíz sin colisión.

### 🔴 Riesgo producción-crítico

El exportador `/api/paciente/[id]/exportar/route.ts` es usado por el flujo de "Exportar expediente". Si se hace `DROP TABLE laboratorios` sin migrar este endpoint primero, el exportador falla en producción.

Orden estricto de sub-fase 8:

1. Migrar el exportador al nuevo modelo (leer de `mediciones_analitos`)
2. Migrar `/estado` al nuevo modelo
3. Eliminar páginas y APIs legacy (puntos 3-6 arriba)
4. Eliminar `useLaboratoriosNormalizados.ts`
5. `DROP TABLE laboratorios` (último paso, después de validar que 1-4 están verdes)

## Inventario de archivos a eliminar en sub-fase 8

Confirmados huérfanos al cierre de sub-fase 8:

- `src/hooks/useLaboratoriosNormalizados.ts`
- `src/app/(app)/expediente/[id]/laboratorios/[labId]/page.tsx`
- `src/app/(app)/expediente/[id]/laboratorios/nuevo/page.tsx`
- `src/app/api/laboratorios/route.ts`
- `src/app/api/laboratorios/[id]/route.ts`

A evaluar en sub-fase 8 (decidir eliminar vs migrar al inspeccionar contenido):

- `src/app/(app)/laboratorios/page.tsx` (15665 bytes, Apr 7) — ruta standalone descubierta en validación visual de sub-fase 2

En Supabase:

- Tabla `laboratorios` (confirmada borrable, data de prueba no productiva)

## Registro de fixes post-ejecución sub-fase 1A

Dos fixes aplicados después de la ejecución inicial en Supabase. Ambos están incorporados en el archivo SQL del repo, así que una migración desde cero queda correcta.

### Fix 1 — REVOKE incluye rol `anon`

El REVOKE EXECUTE original cubría `public` y `authenticated`, pero NO `anon`. En Supabase, `anon` es un rol independiente que puede llamar funciones RPC vía `POST /rest/v1/rpc/` sin autenticación. Sin ese REVOKE, cualquier cliente no autenticado podía disparar `sync_antropometria_paciente` bypaseando RLS de `pacientes`.

Archivo actualizado: los 2 REVOKE en sección 4 de `supabase_migration_labs_trigger_antropometria.sql` ahora incluyen `public, authenticated, anon`.

### Fix 2 — Fallback en cálculo de IMC (Opción B, decisión α)

Bug descubierto en smoke test: al insertar medición de peso sin medición previa de talla en `mediciones_analitos`, el IMC no se recalculaba (v_talla quedaba NULL, el IF saltaba el recálculo).

Comportamiento nuevo: la función `sync_antropometria_paciente` usa `COALESCE(medición, pacientes.*)` como valor efectivo para calcular IMC. Las columnas `peso_kg` y `talla_cm` en `pacientes` siguen sincronizándose SOLO con valores de `mediciones_analitos` (decisión α no modificada).

Archivo actualizado: sección 1 del trigger — función completa reescrita en `supabase_migration_labs_trigger_antropometria.sql`.

## Registro de revisión clínica sub-fase 1B

Seed generado con 175 analitos en 17 paneles. Revisión clínica por Angel (médico traumatólogo/columna) aplicó 3 ajustes post-revisión:

### Ajuste 1 — urea: sinónimos

Eliminado `'BUN x 2.14'` del array `nombres_alternativos` porque sugería (incorrectamente) que el analito `urea` se deriva de `bun`. Son analitos independientes; el laboratorio MX reporta uno u otro según su convención. Sinónimos finales: `urea serica`, `urea sérica`, `urea en sangre`, `nitrogeno ureico`.

### Ajuste 2 — procalcitonina: rango clínicamente correcto

Rango original `{"ok_max": 0.5}` pintaba verde en zona de infección bacteriana local-moderada (0.1-0.5 ng/mL). Cambiado a `{"ok_max": 0.1, "warn_max": 0.5}`. Semántica correcta: verde < 0.1, amarillo 0.1-0.5, rojo > 0.5.

### Ajuste 3 — cea: comentario de variación por perfil

Agregado comentario `-- verificar: cutoff 5 para no fumadores, 10 para fumadores` al INSERT. El rango hardcodeado (`ok_max: 5`) aplica a no fumadores. Para fumadores el cutoff literature-standard es 10. Modelado de "perfil del paciente" (fumador/no fumador) es deuda de V2 — no se implementa en V1.

## Claves literales críticas confirmadas en DB

Verificadas post-ejecución:

- `peso` — categoria `antropometria`, unidad `kg` → usada por trigger de antropometría
- `talla` — categoria `antropometria`, unidad `cm` → usada por trigger de antropometría
- `ta_sistolica` — categoria `signos_vitales`, unidad `mmHg` → usada por UX especial del modal TA (sub-fase 3)
- `ta_diastolica` — categoria `signos_vitales`, unidad `mmHg` → usada por UX especial del modal TA (sub-fase 3)

## Pendientes no bloqueantes

- Regenerar `src/types/database.types.ts` usando Supabase CLI. Las 5 interfaces manuales en `src/types/index.ts` (CategoriaAnalito, BandsType, RangoAnalito, AnalitoCatalogo, MedicionAnalito) suplen por ahora. Puede hacerse antes de sub-fase 9 (QA final). Comando: `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`.
- `useStatsLabs` descarga `analito_id`/`nombre_custom` de TODAS las mediciones del paciente al cliente para hacer count distinct en JS (Set). Suficiente para cardinalidades típicas (decenas de mediciones por paciente). Si la cardinalidad escala a 500+ mediciones por paciente, promover a RPC Postgres con `count(distinct ...)` en sub-fase 9 o posterior. Origen de la decisión: sub-fase 2, evitar crear migración SQL fuera de scope.

## Sub-fase 7 — decisiones de implementación

- **Posición en el grid**: 6ª card al final del markup en `ExpedienteCardsGrid.tsx`. Por el `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`, en desktop ancho (≥3 columnas) queda en fila 2 posición 3 como se acordó. No se reordenó ninguna de las 5 cards existentes.
- **Color del ícono**: teal-600 (`#0d9488`). Distinto del `#14b8a6` (teal-500) de "Última visita" para evitar duplicación cromática pero mantener la familia semántica teal = labs/estadística.
- **Ícono**: `Activity` de lucide-react.
- **Subtitle dinámico**: 4 variantes con pluralización singular/plural y separador `·` (U+00B7) idéntico al del Hero del expediente. Helper `labsSubtitle()` local al componente (no se extrajo a `src/lib/` porque es uso único — regla del proyecto: no abstraer hasta >1 consumidor).
- **Consumidor del stats**: `useStatsLabs` extendido con 3ª query paralela a `documentos` filtrando `tipo IN ('resultado_laboratorio','estudio_imagen')` y retornando `documentosCount`. Hasta que sub-fase 6 implemente la subida, `documentosCount` retornará 0 (CHECK constraint extendido en sub-fase 1A permite los dos tipos nuevos en DB). Sin regresión en `HeroLabs` — solo lee `analitosTracked` y `ultimaMedicionISO`.
- **Invalidación SWR**: la 3ª query comparte la misma key `['stats-labs', pacienteId]` — cuando sub-fase 3 llama `mutate()` tras crear una medición, ya refresca también el count de documentos automáticamente. Futuras subidas de documentos en sub-fase 6 deberán llamar esa misma `mutate()`.

## Sub-fase 4 — decisiones de implementación

- **DELETE endpoint**: `src/app/api/labs/mediciones/[id]/route.ts`. Patrón unánime del repo (`documentos/[id]`, `consultas/[id]`, `appointments/[id]`, etc.). Usa `RouteContext<'/api/labs/mediciones/[id]'>` para tipado seguro del `ctx.params`. Audit log automático vía trigger `audit_mediciones_analitos` (aplicado en sub-fase 1A).
- **Dropdown construido desde cero**: no hay `<Select>`/`<Listbox>` genérico en el repo. Replica el patrón de `AutocompleteAnalito` (sub-fase 3) — click-outside, keyboard ↑↓ Enter Esc, `IOS_EASING`, `normalizar()` NFD-strip, agrupado por categoría. No se abstrajo (regla anti-abstracción prematura — si aparece un 3er selector se refactoriza entonces).
- **Clave efectiva derivada en render, NO en useEffect**: el linter de React 19 marca `setState dentro de useEffect` como cascading-render error. En vez de sincronizar con useEffect, derivo `claveSeleccionada` con `useMemo` sobre `[analitos, claveUsuario]`. Si la selección del usuario sigue viva → se respeta; si no (o si no hay) → cae al más reciente. Elimina el re-render extra y pasa lint estricto.
- **Delta 2-color**: solo rojo/verde para `high-bad` y `low-bad`. `low-and-high-bad`, `none` y custom → gris neutro (decisión confirmada por Angel). La semántica correcta para `low-and-high-bad` requiere bandas — se resuelve en sub-fase 5.
- **Same-day indicator**: comparación con `date-fns format(parseISO(iso), 'yyyy-MM-dd')` en local timezone (correcto para "día clínico" del médico que captura cerca de medianoche).
- **Paginación de tabla**: default 10 últimas (DESC), botón "Ver todas (N)" expande a completo, "Ver menos" colapsa.
- **Invalidación SWR en DELETE exitoso** — 3 keys: `['stats-labs', pacienteId]`, `['analitos-rastreados', pacienteId]`, `['mediciones-analito', pacienteId, claveSeleccionada]`. Misma invalidación ampliada en el `onSuccess` del modal de agregar (sub-fase 3) — vive en el padre `SeccionMedicionesLabs`, no se modificó `ModalAgregarMedicion.tsx`.
- **Re-selección post-delete**: al eliminar la última medición del analito seleccionado, la `claveUsuario` queda "huérfana" (no existe en `analitos`). El `useMemo` de `claveSeleccionada` detecta y auto-cae al siguiente más reciente. Si no quedan analitos, cae a `null` → render vuelve al empty state. Sin useEffect.
- **AnalitoDetailHeader recibe catálogo como prop**, no lo fetcha: lookup en `SeccionMedicionesLabs` con `catalogo.find(a => a.id === analitoSeleccionado.analitoId) ?? null`. Evita render extra esperando SWR y reutiliza cache compartido de `useCatalogoAnalitos`.

## Sub-fase 5 — decisiones de implementación

- **Librería**: Recharts 3.8.1 ya en bundle (confirmado por imports en `src/components/super-admin/charts/SerieCharts.tsx` y `src/app/(app)/estadisticas/page.tsx`). Cero instalación.
- **Color primario del médico en SVG (`var(--cp)`)**: aplicada **Opción D** (style inline con var). Atributos SVG no resuelven CSS custom properties, pero el prop `style` sí. Patrón: `stroke="currentColor"` como fallback SVG + `style={{ stroke: 'var(--cp)', color: 'var(--cp)' }}` en `<Line>` — el style gana sobre el atributo. Para `dot`/`activeDot` Recharts reenvía el objeto como props al Dot interno, incluyendo `style`, que llega al `<circle>` como atributo `style="fill: var(--cp)"`. **Pendiente de verificación visual con devtools** por Angel: inspeccionar `<path stroke>` y `<circle fill>` computed values; si sale `currentColor` literal, caer a Opción E (resolver con `getComputedStyle` en `useEffect`). No hardcodeado.
- **Colores de bandas**: 2B — no existen CSS vars semánticas en `globals.css` (solo `--azul-*`). Definidas como `BAND_COLORS` en `src/lib/labs/utils.ts` (fuente única). Verde `#10b981`/0.12, amarillo `#f59e0b`/0.15, rojo `#ef4444`/0.12. Pills en la leyenda y `<ReferenceArea>` de Recharts consumen desde ahí. Migrar a `var(--color-success)` etc. cuando el repo adopte tema semántico.
- **Patrón Recharts replicado del super-admin**: `ResponsiveContainer` wrapper + `LineChart` con margin + `CartesianGrid strokeDasharray="3 3"` (vertical=false) + `XAxis`/`YAxis` con `tick={{fill, fontSize}}` + `Tooltip` con `content={(props) => <div tailwind>...</div>}` (no el default) + `Line type="monotone"` con `dot`/`activeDot` como objetos + `ReferenceArea` para bandas (ifOverflow="visible"). Tema claro (stroke `#e2e8f0`) en vez del oscuro del super-admin.
- **yMin/yMax incluye bandas + 10% padding (decisión B)**: `min/max` sobre valores medidos + `rango.warn_min??ok_min` + `rango.warn_max??ok_max`; padding 10% del rango; clamp yMin>=0. Si maxBase==minBase (1 sola medición sin rangos), inflar ±10% del valor o ±1.
- **statusOf por bands_type**: matriz exacta a spec del usuario.
  - `high-bad`: `ok` si `valor <= ok_max`; `warn` si `valor <= warn_max`; `bad` si `valor > warn_max` (o `>ok_max` cuando no hay warn).
  - `low-bad`: `ok` si `valor >= ok_min`; `warn` si `valor >= warn_min`; `bad` si `valor < warn_min` (o `<ok_min` cuando no hay warn).
  - `low-and-high-bad`: `ok` dentro de `[ok_min, ok_max]`; `warn` en cualquiera de las franjas `[warn_min, ok_min)` / `(ok_max, warn_max]`; `bad` fuera.
  - `none` o sin `analitoCatalogo`: `neutral` siempre.
- **Override por sexo (`getRangoEffective`)**: `M + rango_masculino` → rango_masculino. `F + rango_femenino` → rango_femenino. `Otro`/`null` o analito sin override → `rango_default`. Custom (`analitoCatalogo=null`) → retorna `null`, `statusOf='neutral'`, `LeyendaBandas` muestra mensaje "sin rangos de referencia".
- **Filtro temporal reset al cambiar analito**: patrón **render-time state sync** (no `useEffect`), alineado con la regla de sub-fase 4 ("setState dentro de useEffect es cascading-render error"). Tupla implícita `claveSnapshot`: si `claveSnapshot !== claveSeleccionada` durante render, `setClaveSnapshot(claveSeleccionada)` + `setRangoTemporal('todo')`. React re-ejecuta el render pero no commitea el intermedio.
- **Filtro aplicado a gráfica Y tabla**: `medicionesFiltradas` derivado con `useMemo` desde `mediciones + rangoTemporal`; se pasa a `GraficaAnalito` y a `TablaMediciones`. `AnalitoDetailHeader` sigue recibiendo `mediciones` (histórico completo) — la intención del header es contexto clínico, no vista filtrada.
- **Contadores del filtro**: `useMemo` único que calcula los 6 counts en una pasada (no 6 memos separados).
- **Tooltip custom con `statusLabelDetailed`**: "En rango" / "Sobre/Bajo el rango normal" (warn) / "Fuera de rango alto/bajo" (bad) / "Sin rango de referencia" (neutral). Para `low-and-high-bad` usa `valor > rango.ok_max` para decidir si "alto" o "bajo".
- **Tabla `TablaMediciones` NO se tocó**: ya recibe `mediciones` como prop desde sub-fase 4; ahora `SeccionMedicionesLabs` le pasa `medicionesFiltradas`. El expander interno `LIMITE_DEFAULT=10` sigue vivo — viewport management independiente del filtro temporal.
- **Cadena de `sexoPaciente`**: `page.tsx` ya fetcha `Paciente.sexo` (`'M'|'F'|'Otro'`). Agregado `sexoPaciente={paciente.sexo}` al render de `SeccionMedicionesLabs`. De ahí se propaga a `GraficaAnalito` y `LeyendaBandas`. `AnalitoDetailHeader` NO lo recibe (no calcula bandas en esta sub-fase — sigue usando `bands_type` para delta-color únicamente).
- **Placeholder + CTA "Ver todas"**: cuando `medicionesFiltradas.length===0` pero `mediciones.length>0`, `GraficaAnalito` renderea placeholder con botón que resetea filtro a `'todo'` (callback `onResetFiltro` desde el padre). La tabla se oculta en ese caso para evitar doble mensaje de "vacío".
- **Verificación Opción D en runtime**: el `style={{ stroke: 'var(--cp)' }}` resolvió correctamente el primario del médico (`#1a3a5c`) en el SVG de Recharts sin requerir el fallback useEffect de Opción E. Navegador testeado: Chrome/Edge (Next.js 16 + Webpack en dev server). No se requirió hardcodear colores en ningún punto.

## Sub-fase 6A — decisiones y fixes de implementación

Sub-fase SQL-only. Ejecutada manualmente por Angel en Supabase SQL
Editor en 6 pasos con validación entre cada uno el 2026-04-22. El
archivo `supabase_migration_labs_documentos_upload.sql` en la raíz
del repo contiene todo el SQL consolidado, con header de advertencia
"NO EJECUTAR EN PRODUCCIÓN" — existe solo para trazabilidad y
recreación en ambientes nuevos.

### Orden de ejecución (6 pasos)

1. **ALTER TABLE documentos ADD 6 columnas nullable**: `storage_bucket`,
   `storage_path`, `mime_type`, `tamaño_bytes`, `nombre_original`,
   `subido_por` (FK a `profiles(id) ON DELETE RESTRICT`). Todas
   nullable para no romper los 494 registros existentes.
2. **ALTER COLUMN contenido DROP NOT NULL**: permitir que uploads no
   tengan contenido estructurado. Los 494 registros ya tenían
   `contenido='{}'` o poblado, sin impacto.
3. **ADD CONSTRAINT `documentos_tiene_origen_check`**: `contenido IS
   NOT NULL OR storage_path IS NOT NULL`. Los 494 existentes pasan.
4. **CREATE FUNCTION `enforce_limite_documentos_paciente()` + trigger
   `trg_documentos_limite_paciente` (BEFORE INSERT)**: `SECURITY
   DEFINER` + `search_path = public` + `REVOKE EXECUTE` de
   `public, authenticated, anon` (mismo patrón del Fix 1 de sub-fase
   1A para el trigger de antropometría).
5. **Fix del trigger** — ver sección dedicada abajo.
6. **4 policies en `storage.objects` para bucket `labs-documentos`**:
   SELECT / INSERT / UPDATE / DELETE, scopeadas por clínica con
   `storage.foldername(name)[2] = public.get_clinica_id()::text`.
   Estructura de path esperada:
   `clinicas/{clinica_id}/pacientes/{paciente_id}/{uuid}.{ext}`.

### Fix del trigger — filtrado por tipo

Versión 1 (inicial) contaba **todos** los documentos del paciente y
rechazaba el INSERT 101 fuera cual fuera el `tipo`:

```sql
select count(*) into v_count
from public.documentos
where paciente_id = NEW.paciente_id;
```

Problema: un paciente con 100 recetas/informes/solicitudes acumuladas
quedaba bloqueado para todo futuro `INSERT` en `documentos`, incluida
la siguiente receta. Esto rompía flujos de consulta en producción.

Versión 2 (ejecutada y versionada en el archivo SQL del repo):

```sql
if NEW.tipo not in ('resultado_laboratorio', 'estudio_imagen') then
  return NEW;
end if;

select count(*) into v_count
from public.documentos
where paciente_id = NEW.paciente_id
  and tipo in ('resultado_laboratorio', 'estudio_imagen');
```

Guarda temprana + count filtrado. Solo los uploads clínicos de
`/laboratorios` entran en el cupo de 100. Documentos generados por la
app no compiten por el cupo y no se bloquean.

### Gap histórico observado — no se corrige aquí

El bucket `documentos-pdf` (migración
`supabase_migration_storage_documentos_pdf.sql`, abril 2026) tiene
policies que solo validan `bucket_id = 'documentos-pdf'` sin scoping
por clínica. Técnicamente cualquier usuario autenticado puede leer
archivos de otras clínicas si conoce el path (UUID-based, difícil de
adivinar, pero no imposible). El bucket nuevo `labs-documentos` sí
scope por clínica vía `storage.foldername(name)[2]`.

Este gap queda documentado pero **NO se toca en 6A** (fuera de scope).
Candidato a hardening en una sub-fase de seguridad futura.

### Decisión — NO se agrega FK `pdf_url` → `storage_path`

La tabla `documentos` conviverá con 2 generaciones de documentos en
paralelo:

- **Generados por la app** (recetas, informes, etc.): siguen poblando
  `contenido` jsonb + `pdf_url` (path en bucket `documentos-pdf`).
- **Subidos en /laboratorios**: pueblan `storage_bucket =
  'labs-documentos'` + `storage_path` + `mime_type` + `nombre_original`
  + `subido_por`. `contenido` queda NULL.

No se promueve `storage_path` como fuente única ni se migran los 494
registros existentes de `pdf_url` → `storage_path` porque:

1. El CHECK `documentos_tiene_origen_check` acepta ambos mecanismos
   como válidos.
2. Migrar los 494 registros introduce riesgo sin beneficio funcional
   inmediato.
3. Sub-fase 6B leerá `storage_path` cuando `storage_bucket IS NOT
   NULL`, y `pdf_url` como fallback — la divergencia es manejable en
   el cliente.

### Pendiente no bloqueante de 6A

- Regenerar `src/types/database.types.ts` con Supabase CLI. Las 6
  columnas nuevas son nullable y quedarán tipadas automáticamente.
  Mientras tanto, el union `TipoDocumento` de `src/types/index.ts` ya
  incluye `'resultado_laboratorio'` y `'estudio_imagen'` (agregados en
  esta sesión). El resto de la metadata de uploads (storage_path, etc.)
  se tipará manualmente en la interfaz `Documento` o equivalente al
  arrancar sub-fase 6B si hace falta antes de la regeneración.

## Pendientes de cierre al final del rediseño

- [ ] Sub-fase 8 ejecutada con orden estricto del bloque de riesgo
- [ ] DROP TABLE laboratorios manual en Supabase después de sub-fase 8 verde
- [ ] Verificar que Sentry no registra errores de "relation does not exist" post-drop
- [ ] Cerrar items 2 y 3 de CLAUDE.md (useLaboratoriosNormalizados + tabla laboratorios)
