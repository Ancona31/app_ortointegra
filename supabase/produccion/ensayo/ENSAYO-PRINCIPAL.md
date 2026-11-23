# Ensayo principal E1 — bloque 5 (5.1, 5.2, 5.3 y 5.6)

> Agente E1, rama `feature/agenda-v2-produccion` (punta de partida `b2993fe1`),
> 2026-11-23. **Nada contra producción.** Base local compartida
> (`supabase_db_app_ortointegra`, 127.0.0.1:54322), único agente corriendo.
> «[C]» = comprobado (cómo, al lado); «[D]» = deducido (no ejecutado).
> Evidencias crudas: `~/spinus-fusion/ensayo-e1/` (fuera del repo). La foto de
> producción se leyó desde `~/spinus-produccion-foto/`; aquí sólo hay nombres de
> objetos, md5 y recuentos.

## 5.1 — La base local como clon de la foto, y las 9 con el guion real

### Base de partida: 5 de `main` + deriva [C]

- **Método:** copia de `supabase/` en `~/spinus-fusion/ensayo-e1/stack/supabase/`
  con SÓLO las 5 primeras migraciones de `supabase/migrations/` y el
  `config.toml` idéntico (mismo `project_id = "app_ortointegra"`, para que la
  CLI apunte a los mismos contenedores). `npx --yes supabase@2.117.0 db reset
  --local --workdir ~/spinus-fusion/ensayo-e1/stack` → 5 versiones en el
  historial (`01-reset-cinco.txt`). El `config.toml` del repo no se tocó.
  Elegido porque no toca ningún archivo del repo y deja la base exactamente
  como la dejaría `main`.
- **Deriva:** `deriva.sql` del agente E2 (`~/spinus-fusion/ensayo-e2-trabajo/`),
  releído antes de usarlo: retira los GRANT que el replay da de más
  (`DERIVA.md` §4: 7 funciones, 4 tablas a `anon`, 1 a `authenticated`) y pone
  `\r\n` en los cuerpos de las 32 funciones (`DERIVA.md` §0). Resultado
  (`02-deriva.txt`): 32 funciones con `\r`; md5 de `clinica_no_suspendida`
  `bff6c203…`, `clinica_tiene_acceso` `038f41ee…`, `prevent_audit_modification`
  `7f0318cb…` = los de producción.
- **Contra la foto** (`comparar-estructura.sh`, `05-catalogo.jsonl` ↔ la base,
  `03-dif-prod-vs-cinco-app.*`): en `public|private|respaldos` **sólo 3
  diferencias de la app**, el deparseo de tres CHECK
  (`consultas_nota_origen_check`, `solicitudes_arco_estado_check`,
  `solicitudes_arco_tipo_check`; ya explicado en `DERIVA.md` §4). Las otras 13
  filas del resumen de esos esquemas son de plataforma: `pg_cron` (extensión,
  comentario, `cron`), la publicación `supabase_realtime_messages_publication`,
  roles de la CLI (`cli_login_postgres`, `supabase_functions_admin`, miembros de
  `postgres` y `supabase_realtime_admin`), configuración de roles
  (`session_preload_libraries`, `search_path`, `app.settings.jwt_secret`) y
  `issue_pg_graphql_access`. Sin filtrar esquemas: 547 diferencias, todas en
  `storage`, `realtime`, `auth`, `_realtime`, `supabase_functions`,
  `extensions`, `cron`, `pgbouncer` (versión de la plataforma) más las 16 de
  arriba.
- **Datos antes de aplicar:** se sembró la base de 5 (`05-semilla-cinco.txt`)
  para que el backfill de F1 tenga consultorios: 365 citas, 4 consultorios, 2
  clínicas, 39 filas de `audit_log`, 4 perfiles.

### Conteos, estado y las 9 [C]

| Paso | Resultado | Evidencia |
|---|---|---|
| `conteos/correr-conteos.sh` (`CONTEOS_HOST=127.0.0.1 …`, contraseña local por stdin) | **0 ALTO, 0 AVISO: 73 OK, 5 INFO** (lo mismo que el clon de la foto); las INFO: G.13 tamaños, M2.8 (29), F1.11, T.1, T.2 | `04-conteos/` |
| `aplicar.sh estado` (`APL_HOST=127.0.0.1 APL_PUERTO=54322 APL_USUARIO=postgres APL_SSL=disable APL_RED=host`, `PGPASSWORD` local) | «Destino: ENSAYO»; humo: petición de 104 104 bytes en UNA petición, sólo lectura, aceptada (0,34 s); historial 5; las 9 `pendiente`; salida 0 | `06-aplicar/estado-antes.txt` |
| `aplicar.sh aplicar` (las 9 versiones por stdin) | **las 9 `✓ aplicada y registrada`**, 0,28–0,41 s cada una (contenedor incluido); «Las 9 aplicadas y registradas (historial y catálogo coinciden)»; salida 0 | `06-aplicar/aplicar.txt` y `*.salida.txt` |
| Rejillas | 63 OK + 10 INFO, **0 REVISAR**; mismas filas y veredictos, una a una, que `rejillas-del-ensayo.txt` (`diff` vacío sobre «nº + veredicto») | idem |
| `aplicar.sh estado` después | historial con las **14** versiones en el orden de `COMPROBACION-POSTERIOR.md` §4; las 9 «aplicada y registrada» | `06-aplicar/estado-despues.txt` |

Huellas: `sha256sum aplicar.sh` = `67ec5d14…` (la del plan §2) y
`sha256sum -c huellas.sha256` todo OK [C].

### Comprobación posterior [C]

- **Antes ↔ después** (`comparar-estructura.sh` entre la base de 5 + deriva y la
  de 14): 2559 → 3440 objetos, **965 diferencias, con las MISMAS claves**
  (cut -f1-5) que `plan/diferencias-antes-despues.clon-foto.tsv`: `diff` vacío
  (`07-*`). Es decir, sobre una base con datos el conjunto cambia exactamente
  lo mismo que sobre el clon vacío de la foto.
- **`catalogo-despues.sql`** (`08-catalogo-despues.txt`): todas las filas con el
  valor de la tabla de `COMPROBACION-POSTERIOR.md` §5: 14 / 9 / 15 / true / 0 /
  0 / 22 / 1 / 12 de 12 / 45 / 0 / 112 / 0 / 0 / 0 / `0 / 0` / 0 / **4 / 4**
  (datos) / 0 / `a2dcfa8f…` / `2efd7734…`.
- `audit_log`: 39 → 43 (+4, una por consultorio del backfill de F1), como dice
  §4 de la comprobación.
- Nota de montaje: la CLI deja `supabase/.temp/` en el repo al hacer `repair`
  (está en `.gitignore`).
