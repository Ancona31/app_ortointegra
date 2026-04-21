# LABS_REDISEÑO_NOTES.md

Notas vivas del rediseño del sistema de laboratorios. Se actualiza por sub-fase.

## Estado por sub-fase

| # | Sub-fase | Estado | Commit |
|---|---|---|---|
| 0 | Cleanup y deuda técnica | ✅ Cerrada en 2026-04-21 | pendiente (Angel hace commit manual) |
| 1A | Schema SQL: tablas + RLS + trigger | ⏳ SQL generados, esperando ejecución manual por Angel (2026-04-21) | — |
| 1B | Seed del catálogo de analitos | ⏳ Pendiente | — |
| 2 | Página base + Hero + secciones vacías | ⏳ Pendiente | — |
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

En Supabase:

- Tabla `laboratorios` (confirmada borrable, data de prueba no productiva)

## Pendientes de cierre al final del rediseño

- [ ] Sub-fase 8 ejecutada con orden estricto del bloque de riesgo
- [ ] DROP TABLE laboratorios manual en Supabase después de sub-fase 8 verde
- [ ] Verificar que Sentry no registra errores de "relation does not exist" post-drop
- [ ] Cerrar items 2 y 3 de CLAUDE.md (useLaboratoriosNormalizados + tabla laboratorios)
