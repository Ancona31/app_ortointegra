# LABS_REDISEÑO_NOTES.md

Notas vivas del rediseño del sistema de laboratorios. Se actualiza por sub-fase.

## Estado por sub-fase

| # | Sub-fase | Estado | Commit |
|---|---|---|---|
| 0 | Cleanup y deuda técnica | ✅ Cerrada en 2026-04-21 | pendiente (Angel hace commit manual) |
| 1A | Schema SQL: tablas + RLS + trigger | ✅ Cerrada 2026-04-21 | pendiente (Angel hace commit manual) |
| 1B | Seed del catálogo de analitos | ✅ Cerrada 2026-04-21 (175 analitos) | pendiente (Angel hace commit manual) |
| 2 | Página base + Hero + secciones vacías | ✅ Cerrada 2026-04-22 | pendiente (Angel hace commit manual) |
| 3 | Modal "Agregar medición" + autocomplete + custom | ⏳ Pendiente | — |
| 4 | Dropdown selector + detail header + tabla | ⏳ Pendiente | — |
| 5 | Gráfica con bandas + tendencia + leyenda | ⏳ Pendiente | — |
| 6 | Integración Documentos | ⏳ Pendiente | — |
| 7 | Card "Laboratorios" en ExpedienteCardsGrid | ⏳ Pendiente | — |
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

## Pendientes de cierre al final del rediseño

- [ ] Sub-fase 8 ejecutada con orden estricto del bloque de riesgo
- [ ] DROP TABLE laboratorios manual en Supabase después de sub-fase 8 verde
- [ ] Verificar que Sentry no registra errores de "relation does not exist" post-drop
- [ ] Cerrar items 2 y 3 de CLAUDE.md (useLaboratoriosNormalizados + tabla laboratorios)
