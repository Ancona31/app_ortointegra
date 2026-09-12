# Archivo histórico de migraciones

> **Archivado el 2026-09-12, en la rama `chore/entorno-local`.**
> 115 archivos `.sql`. Nada de lo que hay aquí se ejecuta, se replayea ni se
> toma como referencia del esquema.

---

## ⛔ Lo primero, porque es lo que puede romper producción

**NADIE debe correr `supabase db push` contra producción sin antes reparar la
tabla de control del CLI.**

La tabla `supabase_migrations.schema_migrations` de producción no conoce ninguna
de estas migraciones: se aplicaron a mano, pegándolas en el SQL Editor, durante
seis meses. El CLI no tiene forma de saber que ya corrieron. Si alguien apunta
el CLI a un directorio de migraciones poblado y hace `push`, **el CLI intentará
aplicar de nuevo más de 60 migraciones que ya están vivas en producción** —
`DROP POLICY`, `DROP CONSTRAINT`, `ALTER TABLE`, `DROP TABLE` incluidos.

Por eso este directorio **no** se llama `migrations` y **no** vive dentro de
`supabase/migrations/`: para que el CLI no lo vea nunca.

Si algún día se quiere volver a un flujo de migraciones versionadas, el paso
previo obligatorio es `supabase migration repair --status applied <versión>`,
uno por cada migración ya aplicada, antes de cualquier `push`.

---

## Qué hay aquí y de dónde vino

| Subcarpeta | Archivos | Origen |
|---|---|---|
| `migrations/` | 69 | `supabase/migrations/` |
| `raiz/` | 44 | Raíz del repo (`supabase_migration_*.sql` + `supabase_schema.sql`) |
| `sueltos/` | 2 | `scripts/schema-dump-queries.sql` y `supabase/plantillas_danadas_limpieza.sql` |

**Los nombres originales se conservan intactos.** Son parte del registro: el
`git log` de cada archivo, las citas cruzadas entre cabeceras y las referencias
de `CLAUDE.md` y `DEUDA_TECNICA.md` dependen de ellos.

Se movieron con `git mv`, así que `git log --follow <archivo>` sigue funcionando
y el historial completo de cada uno se conserva.

### Lo que NO se archivó, y por qué

- **`supabase/baseline/`** (9 archivos) — sigue en su sitio. Es el volcado real
  del esquema de producción del **2026-04-26**, reconstruido desde
  `information_schema` y `pg_catalog`. Es referencia válida, no historia.
- **`supabase/migrations/descartadas/`** (1 archivo) — sigue en su sitio. Ya
  estaba archivado por definición: es una migración retirada a propósito
  (`20260808_folio_02_clases_faltantes.sql`, sustituida por
  `20260811_folio_03_denegacion.sql`). El CLI recorre **solo el nivel raíz** de
  `migrations/`, así que un `.sql` dentro de una subcarpeta queda fuera de su
  alcance y no participa de ningún `push` ni `pull`.

---

## Por qué se archivaron

### 1 · Los nombres de 8 dígitos rompen el CLI

El CLI de Supabase espera `<YYYYMMDDHHmmss>_nombre.sql` — **14 dígitos**. De los
69 archivos de `supabase/migrations/`, **solo 5 cumplían**; los otros 64 llevaban
8 (`20260427_b1_01_clinicas_rls.sql`). Los 5 que cumplían son los únicos que se
generaron con `supabase migration new`; el resto se nombró a mano.

Con nombres que no parsean como versión, `supabase db pull` compara el historial
local contra el remoto, no cuadra nada, y responde pidiendo una ristra de
comandos de reparación — uno por archivo. Ese fue el síntoma que disparó esta
decisión.

### 2 · Cinco archivos de la raíz se pisan entre sí

`supabase_migration_escrito_medico.sql`, `..._internamiento.sql`,
`..._consentimiento.sql`, `..._nota_honorarios.sql` y
`..._labs_documentos_tipos.sql` hacen todos lo mismo: `DROP CONSTRAINT
documentos_tipo_check` seguido de `ADD CONSTRAINT` **con la lista completa de
valores**, no con un delta.

Aplicados fuera de orden, el CHECK queda truncado **sin dar ningún error**, y a
partir de ahí las filas de un tipo perfectamente válido empiezan a rebotar. Solo
el último de la cadena refleja producción (11 valores). Dos migraciones
posteriores —`20260810_plantillas_documento.sql` y
`20260811_folio_03_denegacion.sql`— vuelven a tocar el mismo constraint y mandan
sobre esos cinco.

### 3 · Varios ya no son replayeables a ningún precio

- `supabase_migration_pagination_indexes.sql` indexa `public.laboratorios`,
  tabla que `supabase_migration_labs_drop_legacy.sql` borró.
- `supabase_migration_labs_drop_legacy.sql` hace `DROP TABLE laboratorios` sobre
  una base creada desde `baseline/`, donde esa tabla ya no existe.
- `supabase_migration_independiente_admin.sql` escribe `role='admin'`, valor que
  `20260519114652_etapa4a8_eliminar_rol_admin_legacy.sql` sacó del dominio.
- `supabase_migration_rls.sql` y `..._rls_profiles_tokens.sql` crean las policies
  legacy `TO public` que `20260429_b2_01..04` eliminaron **por fuga de datos
  cross-clínica**. Replayearlas sobre producción reabriría esa fuga.

### 4 · Las cabeceras no son de fiar

Doce archivos abren con `-- PENDIENTE DE APLICAR` y en la mayoría es falso. La
causa está escrita en `supabase/AUDITORIA-MIGRACIONES.md` §7: hasta julio de 2026
el archivo se commiteaba **después** de aplicar y el rótulo nacía cierto; desde
agosto se commitea **antes**, y ningún paso posterior vuelve a mirarlo.
`DEUDA_TECNICA.md` lo tiene registrado como deuda abierta, con la reconciliación
pendiente de una sesión propia con la base delante.

**Al leer cualquier archivo de aquí, su primera línea vale menos que la
clasificación de `INVENTARIO_SQL.md`.**

---

## Esto NO es la fuente de verdad del esquema

La decisión de fondo, tomada por Angel el 2026-09-12:

> **El estado de PRODUCCIÓN es la fuente de verdad del esquema, no el historial
> de migraciones.**

En orden de autoridad:

1. **Lo que capture `supabase db pull`** — el esquema real, en vivo. Es lo que
   manda en cuanto exista.
2. **`supabase/baseline/`** — mientras no haya `db pull`, el volcado verificado
   del 2026-04-26 más las migraciones posteriores.
3. **Este archivo** — **no manda sobre nada.** Sirve para responder «¿de dónde
   salió esta columna y por qué?», no para reconstruir una base.

El historial se conserva dentro del repo por trazabilidad —puede importar para
la NOM-024-SSA3-2012, que exige registro de cambios sobre sistemas de expediente
clínico electrónico—, no porque sea ejecutable.

---

## Para la clasificación detallada

**`INVENTARIO_SQL.md`**, en la raíz del repo. Tiene, archivo por archivo:

- Ruta, tamaño, fecha de alta y de último commit, y primeras líneas de comentario
  de los 125 `.sql` del repo.
- Clasificación en cinco categorías (aplicada / no aplicada o dudosa / consulta
  de trabajo / seed / otro), **con la evidencia de cada veredicto**.
- El orden cronológico real de aplicación, con las ambigüedades marcadas.
- Los conflictos y duplicados, incluida la cadena de `documentos_tipo_check`.
- Los 5 archivos que quedaron clasificados **con reserva**, cada uno con la
  consulta SQL exacta que cerraría la duda contra la base.

> ⚠️ Las rutas que `INVENTARIO_SQL.md` cita quedaron desactualizadas por este
> archivado: apuntan a `supabase/migrations/` y a la raíz del repo. Lo mismo vale
> para las citas de `CLAUDE.md` y `DEUDA_TECNICA.md`. Los **nombres** de archivo
> siguen siendo correctos; lo que cambió es la carpeta.

---

## Dónde están ahora los dos seeds

Dentro de `raiz/`, sin renombrar, pero conviene saber que **no son historia**:
se siguen necesitando para levantar un entorno local con catálogos poblados.

- `raiz/supabase_migration_cat_cie10_seed.sql` — catálogo CIE-10 en español
  (172 KB). Requiere la tabla `cat_cie10` creada antes.
- `raiz/supabase_migration_labs_seed_catalogo.sql` — 175 analitos con rangos de
  referencia mexicanos (47 KB). Requiere `analitos_catalogo` creada antes.

`raiz/supabase_migration_medicamentos.sql` es mixto: crea la tabla **y** la
siembra en el mismo archivo.

Cuando se arme el `supabase/seed.sql` que el CLI espera (`[db.seed]` de
`config.toml` ya lo apunta, y todavía no existe), estos tres son de donde sale
el contenido.
