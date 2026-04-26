# Baseline reconstructivo del schema de producción

Este directorio contiene **archivos baseline** que reproducen el schema actual
de producción del proyecto Supabase `qpnegmmpneseirfyplbf` (Spinus).

**No son migraciones.** Son una foto reconstructiva del estado de prod al
**2026-04-26**, generada a partir de los dumps de `information_schema` y
`pg_catalog` capturados en `docs/schema-recovery-q-results.md`.

Las migraciones futuras (Fase B, Fase C, etc.) van como archivos
independientes en la raíz con prefijo `supabase_migration_*.sql` (patrón
existente del proyecto). Este baseline NO se actualiza tras cada cambio —
sirve únicamente como punto de verdad inicial para arrancar entornos
nuevos (Supabase local, staging, sandbox de QA).

---

## Orden de aplicación

Aplicar en este orden, **uno por uno**, contra una base limpia:

1. `01_extensions.sql`     — extensiones (`pgcrypto`, `pg_trgm`, `uuid-ossp`, `pg_graphql`, `supabase_vault`, `pg_stat_statements`)
2. `02_tables.sql`         — 20 tablas con columnas, defaults, CHECK constraints (sin FKs)
3. `03_indexes.sql`        — índices secundarios (los `_pkey`/`_key` ya vienen con las tablas)
4. `04_foreign_keys.sql`   — 28 foreign keys con `ON DELETE` / `ON UPDATE` explícitos
5. `05_functions.sql`      — 17 funciones custom (helpers, triggers genéricos, reportes super-admin)
6. `06_triggers.sql`       — 12 triggers activos
7. `07_rls_policies.sql`   — `ENABLE ROW LEVEL SECURITY` + 60 policies tal como están en prod
8. `08_view.sql`           — vista `audit_log_view`
9. `09_storage_buckets.sql`— 4 storage buckets (policies de storage requieren paso manual)

El orden importa: las funciones del paso 5 son referenciadas por triggers
(paso 6) y policies (paso 7). Los buckets (paso 9) son independientes y
pueden correr en cualquier momento.

---

## Reconstruir un Supabase local desde cero

Asumiendo que tienes Supabase CLI instalado y un proyecto local inicializado:

```bash
# 1. Iniciar entorno local
supabase start

# 2. Aplicar baseline en orden
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/01_extensions.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/02_tables.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/03_indexes.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/04_foreign_keys.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/05_functions.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/06_triggers.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/07_rls_policies.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/08_view.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/baseline/09_storage_buckets.sql

# 3. (Manual) recuperar storage policies desde dashboard del proyecto de prod
#    y aplicarlas al local. Ver TODO al final de 09_storage_buckets.sql.

# 4. (Opcional) seedear catálogos:
#    - cat_cie10:           supabase_migration_cat_cie10_seed.sql
#    - analitos_catalogo:   supabase_migration_labs_seed_catalogo.sql
#    - medicamentos:        supabase_migration_medicamentos.sql (incluye seed)
```

Los archivos `supabase_migration_*.sql` en la raíz del repo contienen
seeds y migraciones incrementales que se acumularon antes de este baseline.
**No los apliques al baseline** — la mayoría son `ALTER TABLE` que ya están
absorbidos en `02_tables.sql`. Sí aplica los `*_seed*.sql` para tener datos
de catálogo.

---

## Idempotencia

Los archivos están diseñados para correr una vez sobre DB limpia, pero
incluyen patrones idempotentes donde es posible:

- Tablas: `CREATE TABLE IF NOT EXISTS`
- Índices: `CREATE INDEX IF NOT EXISTS`
- Funciones: `CREATE OR REPLACE FUNCTION`
- Vistas: `CREATE OR REPLACE VIEW`
- Triggers: `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
- Policies: `DROP POLICY IF EXISTS` + `CREATE POLICY`
- Buckets: `INSERT ... ON CONFLICT DO NOTHING`

**Excepciones (no idempotentes):**

- `04_foreign_keys.sql` — Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`.
  Re-correrlo sobre DB que ya tiene los FKs falla con `duplicate_object`.
  En DB nueva corre limpio.
- `01_extensions.sql` — usa `CREATE EXTENSION IF NOT EXISTS` (idempotente).
- `07_rls_policies.sql` — el `ENABLE ROW LEVEL SECURITY` es idempotente
  (Postgres no se queja si ya está habilitado).

---

## Qué NO incluye este baseline

- **Storage policies** sobre `storage.objects`: el SQL Editor no las
  expuso. Hay que recuperarlas vía dashboard o Management API.
- **Datos seed** de catálogos (`cat_cie10`, `analitos_catalogo`,
  `medicamentos`): viven en `supabase_migration_*_seed.sql` separados.
- **Comentarios de columnas** (`COMMENT ON COLUMN`): el dump de Q2 no
  capturó comentarios. Si existen en prod, no están aquí.
- **Configuración de Supabase Auth**: providers, redirect URLs, email
  templates, etc. — viven fuera del schema y se configuran por dashboard.
