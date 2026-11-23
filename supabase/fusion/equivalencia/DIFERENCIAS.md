# E0 · Equivalencia de las 44 migraciones originales y las 6 fundidas

**Veredicto vigente (2.ª vuelta, 2026-11-22, tras las correcciones C1, C2 y C3): ACEPTADO.** Hay 118
diferencias de estructura: las 96 de la 1.ª vuelta, que siguen todas, y 22 nuevas. Las 118 están
explicadas y son ACEPTABLES. Las 22 nuevas vienen todas de la poda de comentarios. Ninguna función
cambia una línea de código respecto de la 1.ª vuelta. No hay ninguna DUDOSA ni NO ACEPTABLE.

Marcas: **[E]** = comprobado ejecutando; **[D]** = deducido (leyendo código o catálogo, sin ejecutar).

## 1. Método (el de la 1.ª vuelta, repetido)

| Base | Construcción | Contenedor (borrado al terminar) |
|---|---|---|
| común | clon de `~/spinus-fusion/base-main` (`clonar-desde-foto.sh`: 0 errores; 12 diferencias, las 12 de `esperadas-clon.tsv`, como en la 1.ª) | — |
| **A** | común + las 44 del tag `fusion-originales`, en orden de nombre, `herramientas/aplicar.sh` (psql como `postgres`, `ON_ERROR_STOP`) | `clon-spinus-e0b-a` |
| **B** | común + los 6 `supabase/migrations/202612011[2-7]0000_*.sql` de hoy, en orden de nombre. **Sin `20261201180000`** | `clon-spinus-e0b-b` |
| **V** | común + los 6 fundidos de la 1.ª vuelta (commit `8f5ac083`) | `clon-spinus-e0b-v` |
| C / D | como A / B, sobre un clon con `datos-previos.sql` | `clon-spinus-e0b-c/d` |
| I | común + los 6 de hoy de uno en uno, con `invariante.sql` tras cada uno (§5) | `clon-spinus-e0b-i` |
| P | clon de la foto REAL de producción (`~/spinus-produccion-foto`) + lo que le falta (§6) | `clon-spinus-e0b-prod` |

V no estaba en la 1.ª vuelta. Lo añadí para aislar lo que cambiaron las correcciones: V↔B es
exactamente el efecto de C1, C2 y C3 sobre el catálogo.

**Aplicación [E].** A: 44/44 sin ningún `ERROR`. Su registro es idéntico al de la 1.ª vuelta (diff
vacío, quitando las fechas). Tiene los 2 REVISAR esperados de la rejilla de K1: «con K3 ya aplicada,
REVISAR es lo esperado», y su fila dice OK. B: 6/6 sin ningún `ERROR` ni REVISAR, con 51 OK y 3 INFO,
igual que en la 1.ª vuelta (`salidas/vuelta2/B-aplicar-6-fundidas.log`). F5b exige ahora
`current_user = 'postgres'`, y `aplicar.sh` ya conecta como `postgres`.

## 2. Estructura: dos métodos independientes, el mismo resultado

| Comparación | `comparar-estructura.sh` (catálogo) | `pg_dump --schema-only` por objeto (`dump_objetos.py`) |
|---|---|---|
| A ↔ B | **118** = 96 + 22. Con `--esperadas DIFERENCIAS.tsv`: 118 esperadas, 0 inesperadas, ninguna sin aparecer | **112** objetos = 90 + 22 |
| V ↔ B | **27**: 18 COMMENT y 9 `md5_cuerpo` | **27**: 18 COMMENT y 9 FUNCTION |
| C ↔ D | 118 (las mismas cuentas) | — |

En V↔B no cambia nada más que esos 27 [E]. Lo comprueban los dos métodos y además:
- **Huellas idénticas en A, B y V** [E]. Son las mismas que en la 1.ª vuelta:
  - ACL de tablas con otorgante: 4050 filas, md5 `b7dfd8be`;
  - ACL de columnas: 34; default ACL: 345;
  - columnas de `appointments` (`attnum:nombre:tipo`): 45, md5 `dfd24ac5`;
  - disparadores (`pg_get_triggerdef` + `tgenabled`): 83, md5 `70ca9edf`;
  - `supabase_realtime`: 1 tabla;
  - `pg_description`: 5448 filas.
- **Disparadores y FK** [E]. F4 lleva al final las FK y los disparadores, y F5b usa `CREATE OR
  REPLACE TRIGGER` dentro de un bloque `DO`. Nada de eso deja rastro en el catálogo: los
  disparadores salen con la misma definición, el mismo estado y el mismo orden de disparo (por
  nombre), y las restricciones con la misma definición.
- **Funciones** [E]. Ninguna cambia dueño, SECURITY DEFINER, `proconfig`, volatilidad, firma ni ACL:
  en las 9 sólo cambia `md5_cuerpo`.

## 3. Las funciones cuyo `prosrc` cambió con la poda: sólo comentarios

Son las 9 que se habían declarado, ni una más ni una menos [E: V↔B]. Hice dos pruebas, independientes
entre sí:
1. **`herramientas/cuerpos.py`**: quita comentarios `--` y `/* */` respetando literales `'…'` y
   `$tag$`, colapsa espacios y compara línea a línea. Las 9 dan **IDÉNTICO** frente a V
   (`salidas/vuelta2/cuerpos-V-B.txt`).
2. **Diff de texto crudo V→B**: toda línea quitada o añadida es una línea entera de comentario
   (`^\s*--`) o una línea vacía. Hay **0 líneas de código** tocadas en las 9.

| Función | Archivo · quién | md5 `prosrc` A → V → B | Líneas −/+ (todas de comentario) | Frente a A |
|---|---|---|---|---|
| `reservar_por_enlace` | F3 · C2 | be25c167 → 05553eb1 → 739936d3 | 1/1 («AG-DT-28») | igual que en la 1.ª: sólo comentarios |
| `agenda_bloqueo_preparar` | F5a · C1 | f1f887ec → f1f887ec → dc778b4c | 2/2 | **nueva**: sólo comentarios |
| `cita_confirmacion_contexto` | F4 · C3 | 2fca66ff → 3c99f013 → 27979b04 | 2/2 | igual que en la 1.ª: sólo la línea del interruptor |
| `cita_confirmacion_responder` | F4 · C3 | 7961e24a → 5b6de825 → 1b1fa721 | 2/2 | igual que en la 1.ª: sólo el interruptor |
| `cita_reagendar_clinica` | F4 · C3 | 00656df5 → 1e156fb1 → 5c770c24 | 1/1 | igual que en la 1.ª: sólo el interruptor |
| `cita_reagendar_oferta` | F4 · C3 | dbcd8da8 → dbcd8da8 → 419c936c | 1/1 | **nueva**: sólo comentarios |
| `reagendar_por_enlace` | F4 · C3 | 54b257ed → 54b257ed → b05ddc49 | 3/3 | **nueva**: sólo comentarios |
| `cita_proteger_atendida` | F5b · C3 | cfc4fcd7 → cfc4fcd7 → ba82c230 | 1/1 | **nueva**: sólo comentarios |
| `cita_proteger_cierre` | F5b · C3 | e550ee48 → e550ee48 → 57510b8a | 2/2 | **nueva**: sólo comentarios |

Frente a A, el diff de código (sin comentarios) de las 27 funciones de la 1.ª vuelta es **byte a byte
el mismo** que entonces [E]: comparé las secciones de código de `salidas/cuerpos-funciones.txt` con
las de `salidas/vuelta2/cuerpos-A-B.txt`. Las otras 5 salen IDÉNTICO.

En total, A↔B tiene 32 funciones con el cuerpo cambiado:
- 14 sólo cambian comentarios: las 9 de antes y las 5 nuevas;
- 17 sólo cambian la lectura del interruptor;
- 1 sólo cambia el HINT.

## 4. Lista de diferencias: qué cambió respecto de las 96

`DIFERENCIAS.tsv`: las 96 de la 1.ª vuelta y, al final, las 22 nuevas. Es una fila por diferencia,
con clave exacta (`[` se escribe `[[]`).

**Ninguna de las 96 desapareció** [E: `--esperadas`, 0 «no apareció»]. **5 de las 96 cambian de
valor** pero no de razón, y llevan la anotación «2.ª vuelta» en su fila:
- las 4 funciones de la tabla que no son nuevas: el código frente a A no cambia;
- el COMMENT de `cita_correos`, que además pierde «agenda E4 y G3» y «dimensión 16».

**22 nuevas, todas ACEPTABLES:**

| Qué | Cuántas | Quién | Razón |
|---|---|---|---|
| `md5_cuerpo` | 5 | C1 (F5a: `agenda_bloqueo_preparar`), C3 (F4: `cita_reagendar_oferta`, `reagendar_por_enlace`; F5b: `cita_proteger_atendida`, `cita_proteger_cierre`) | sólo comentarios (§3) |
| COMMENT de función | 12 | C3: F4 (`aviso_clinica_de_confirmacion`, `cita_nombre_saludo`, `cita_reagendar_clinica`, `cita_reagendar_oferta`, `reagendar_por_enlace`) y F5b (`cita_proteger_atendida/bloqueo/borrado/cierre/eleccion/reserva`, `cita_tiene_nota_ligada`) | sin etiquetas de tanda |
| COMMENT de tabla o columna | 5 | C3: F4 (`avisos_clinica`, `cita_confirmaciones`, `cita_reagendos`) y F5b (`appointments.cerrada_en`, `appointments.sustituida_por`) | sin etiquetas de tanda |

El diff por palabras está en `salidas/vuelta2/comentarios-palabras-V-B.txt`. Casi todos sólo quitan
«tanda X, punto N», «D3», «E6», «C5»… Cuatro cambian contenido, y comprobé el texto nuevo contra el
catálogo [E]:
- `aviso_clinica_de_confirmacion` nombra el índice `avisos_clinica_pendiente_key`, que existe.
- `avisos_clinica` enumera los 7 tipos, que son exactamente los del CHECK `tipo = ANY (…)`.
- `cita_proteger_eleccion`: «(Google … restablece, C5)» pasa a «la sincronización con Google rechaza
  el cambio y restablece el evento». Es la regla J4 de CLAUDE.md [D].
- `cita_proteger_bloqueo`: «como hoy» pasa a «como siempre». El sentido no cambia.

**`diferencias/CONJUNTO.tsv`** (el conjunto contra `ref-originales`) está rehecho a partir de los
`.tsv` por bloque de hoy:
- se añaden las 22 filas de la poda: 12 de `F5.tsv` y 10 de `f4.tsv`;
- 4 filas toman la razón de hoy de `f4.tsv`;
- las 3 filas «colateral del ensayo» de `f3.tsv` no entran.

Lo comprobé con B contra `ref-originales/05-catalogo.jsonl`, usando `CONJUNTO.tsv` +
`esperadas-clon.tsv`: **130 diferencias, 130 esperadas, 0 inesperadas** [E]. Las únicas líneas que no
aparecen son de `esperadas-clon.tsv`, como en la 1.ª vuelta. Antes de rehacerlo daba 22 inesperadas,
justo las de la poda.

## 5. Comportamiento [E]

- **`comportamiento.sql` (89 pasos):**
  - A, B y V dan una salida **idéntica byte a byte** (`salidas/vuelta2/comportamiento-*.out`).
  - Frente a la salida de la 1.ª vuelta, sólo se mueven las fechas: el guion usa «hoy + 3 días» y se
    corrió otro día.
- **Pruebas SQL** (`salidas/vuelta2/pruebas-sql.tsv`):
  - A, con las del tag: 45 de 46 pasan.
  - B, con las de hoy: 45 de 47 pasan.
  - Las que fallan son las mismas que se esperaban:
    - `m_saludo_recordatorio`, en los dos lados, porque pide la semilla. Con `semilla-minima.sql`
      pasa en A y en B.
    - `t_agenda_sin_truncate`, sólo en B. Es la prueba de `20261201180000`, que a propósito no se
      aplicó: el caso 3 encuentra el TRUNCATE permitido. No es una diferencia de la fusión.
- **`policy-sin-disparador.sql`:** igual que en la 1.ª vuelta. A deja pasar al administrador por la
  RLS y luego falla con `23514` (CHECK); B lo niega con `42501` (RLS).
- **Datos previos:** `datos-extraer.sql` da C = D, y también igual a `salidas/datos-C.txt` de la 1.ª
  vuelta (diff vacío).
- **Invariante entre archivos** (`invariante.sql` + `herramientas/invariante.sh`):
  - Tras la base y tras CADA uno de F1, F5a, F3, F2, F4 y F5b, en ese orden, hay 24 de 24 pasos con
    `filas=1`: crear, editar (notas y título), mover y cancelar.
  - Los pasos cubren al médico con y sin paciente, a la secretaria y a `service_role`, con la v2
    encendida, y al médico y a `service_role` con la v2 apagada.
  - **No hay ventana rota** (`salidas/vuelta2/invariante-tras-cada-archivo.txt`).
- **Controles negativos del instrumento:**
  - F2 aplicado sin F3 aborta en su propio pre-vuelo: «falta appointments.reserva_canal (F3…)». La
    ventana F2/F3 está cerrada por el archivo, no sólo por el orden.
  - Un disparador que lee `NEW.reserva_canal` antes de que exista la columna hace que el invariante
    falle en todos los «crear», con `42703`. El instrumento detecta una ventana rota.

## 6. Comprobación extra: el conjunto de hoy sobre un clon de la foto REAL de producción [E]

- **Clon.** `clonar-desde-foto.sh ~/spinus-produccion-foto`: 0 errores de restauración y 14
  diferencias con la foto, las 14 de `esperadas-clon.tsv`. La foto tiene las 5 migraciones de `main`,
  no `20261125170000` ni `20261126120000`.
- **Aplicación** como `postgres`, con `aplicar.sh`: `20261125170000`, `20261126120000` y los 6
  fundidos, en ese orden. **Entra limpio:** 8/8, 0 `ERROR`, **0 REVISAR**, 59 OK y 10 INFO en las
  rejillas. Los INFO son conteos: privilegios restantes, filas de `audit_log`, tablas a las que se
  quitó TRUNCATE, privilegios por omisión, consultorios respaldados (0), censo de enlaces (0) y
  clínicas con estado de sincronización (0).
- **Extra.** Después apliqué `20261201180000` aparte: 0 `ERROR`, 0 REVISAR y 4 OK. El invariante sobre
  ese clon, ya con ella, da 24/24 (antes de aplicarla corrió sin error, pero no guardé su resumen).
- No guardé el registro de este clon en el repo, porque refleja la estructura de producción. Sólo
  quedan aquí los conteos.

## 7. Lo que no comprobé

- Lo mismo que en la 1.ª vuelta:
  - `gcal_aplicar_evento` con datos, porque exige una conexión de Google [D, por el diff];
  - `scripts/reserva-carrera.sh` y las e2e;
  - el comportamiento a través de PostgREST [D];
  - estadísticas, planes y rendimiento.
- **Historial de migraciones.** Apliqué con psql, no con la CLI.
- **Candados y tiempos.** No medí el efecto de las reordenaciones para acortar candados (NOWAIT y
  reintentos de F1, FK al final en F4) bajo concurrencia. Sólo vi que el resultado en el catálogo es
  el mismo.

## 8. Historia: la 1.ª vuelta (2026-11-22, antes de C1/C2/C3)

Se compararon las mismas bases A y B con los fundidos de `8f5ac083`. Dio 96 diferencias: 52
comentarios, 31 funciones, 10 permisos y 3 policies. Las 96 fueron ACEPTABLES, y el razonamiento de
cada una sigue en su fila de `DIFERENCIAS.tsv`:
- 9 funciones cambiaban sólo comentarios.
- 17 cambiaban sólo la lectura del interruptor, `EXISTS/JOIN agenda_ajustes` → `public.agenda_v2_encendida(x)`.
  Es equivalente porque es la misma clínica, `agenda_ajustes.clinica_id` es UNIQUE y la columna NOT
  NULL, no había `FOR UPDATE`, todo es INVOKER y el EXECUTE por rol se revisó.
- 1 HINT.
- 1 función nueva (`agenda_v2_encendida`) y 3 retiradas (`reserva_enlace_regenerar_fijo`,
  `reserva_enlace_emitir` de 7 argumentos y `cita_correos_pendientes`), con sus 10 permisos.
- 3 policies: dos con la misma sustitución y `reserva_enlaces_insert` retirada (B, más estricta).
- 52 COMMENT.

En §5 (sentencias de datos y DO) se comprobó que la fusión no perdía escrituras: el backfill de G4
sigue en F1, y el arrastre de i5 inserta siempre 0 filas. Las salidas de entonces siguen en
`salidas/` (sin subcarpeta).

## Archivos

- `DIFERENCIAS.tsv`: las 118, en formato `--esperadas`.
- `comportamiento.sql`, `invariante.sql` (nuevo), `datos-previos.sql`, `datos-extraer.sql`,
  `policy-sin-disparador.sql` y `semilla-minima.sql`: guiones con datos inventados. Todos terminan
  en ROLLBACK salvo `datos-previos.sql`.
- `herramientas/`: las de la 1.ª vuelta e `invariante.sh` (nuevo).
- `salidas/`: la 1.ª vuelta. `salidas/vuelta2/`: la 2.ª.
