# Encargo común de la oleada 2 — fundir las migraciones de la agenda

Lo leen los cinco agentes de fusión (F1 a F5). Lo escribió el coordinador.
Manda sobre lo que diga cualquier otro documento de `supabase/fusion/` si se
contradicen; si encuentras una contradicción, dila en tu reporte.

## 1. Qué se hace y por qué

Las 44 migraciones de la agenda v2 (`20261111120000` a `20261124160000` y
`20261125180000`; 16 478 líneas) **no están aplicadas en producción**. Se
funden en **seis archivos**, uno por bloque funcional, cada uno con la versión
FINAL de cada objeto. El objetivo es un conjunto corto, limpio y fácil de
mantener. **No cambia el comportamiento de la app ni se quita ninguna
comprobación de seguridad:** se ordena y se junta, no se recorta.

Las originales se quedan donde están (`supabase/migrations/`) hasta que el
coordinador integre; su commit de referencia es el tag `fusion-originales`.
**Tú no las borras ni las editas.**

## 2. Tus fuentes

- `supabase/fusion/MAPA-DE-DUENOS.md`: qué objetos son tuyos (§7, la tabla
  completa), lo que otros bloques necesitan de ellos (§3), las dependencias
  (§4) y el orden y los nombres de archivo (§4.1). **Es la ley de la oleada:
  nadie escribe un objeto que no es suyo según el mapa.**
- `supabase/fusion/INVENTARIO.md`: qué crea y qué reescribe cada original, y
  qué quedó sin efecto.
- Las migraciones originales (el SQL es la verdad de la intención y de los
  comentarios) y **el catálogo de la base de referencia** (la verdad de la
  versión final de cada objeto).
- `supabase/AUDITORIA-MIGRACIONES.md`: tu archivo tiene que pasar todas sus
  dimensiones (las 19 a 25 son nuevas). Otro lo auditará; tú no te autoapruebas.
- `scripts/produccion/README.md`: el comparador de estructura y cómo se levanta
  un clon desde una foto.

## 3. Dónde trabajas

- Rama propia `feature/agenda-v2-produccion-<tu letra, p. ej. f1>`, creada
  desde `feature/agenda-v2-produccion`. Commits locales (acaban en
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Sin push.
- Archivos que puedes crear, y sólo éstos:
  - `supabase/fusion/fundidas/<nombre de §4.1 del mapa>.sql` — tu migración;
  - `supabase/fusion/reversas/<mismo nombre>_reversa.sql` — deshace TU bloque;
  - `supabase/fusion/notas/<bloque>.md` — tus notas (ver §8);
  - `supabase/fusion/diferencias/<bloque>.tsv` — diferencias a propósito (§7).
- **No toques** `supabase/migrations/`, `supabase/pruebas-sql/`, `src/`, `e2e/`,
  `scripts/` ni ningún documento fuera de `supabase/fusion/`. Si la limpieza
  obligara a tocar código de la app o una prueba, NO lo hagas: anótalo en tus
  notas («para el coordinador»).
- **Tu base de trabajo es un contenedor propio**, nunca el stack local
  compartido (`supabase_db_app_ortointegra`, que sólo puedes LEER). Hay dos
  fotos locales ya hechas, fuera del repo:
  - `~/spinus-fusion/ref-originales/` — la base con las 51 migraciones
    originales (las 5 de `main`, las 44 de la agenda, `20261125170000` y
    `20261126120000`). **Es la referencia: tu resultado tiene que ser igual.**
  - `~/spinus-fusion/base-main/` — la base sin la agenda (las 5 de `main` más
    `20261125170000` y `20261126120000`).

  Se clonan con
  `scripts/produccion/clonar-desde-foto.sh <foto> <nombre-contenedor> <puerto>`.
  Usa SÓLO tus nombres y tus puertos: contenedores `spinus-<bloque>-*`, puertos
  F1 54341–54349, F2 54351–54359, F3 54361–54369, F4 54371–54379,
  F5 54381–54389. **Bórralos al terminar** (`docker rm -f`). No uses
  `supabase db reset`, ni `supabase link`, ni nada contra producción.
- `audit_log` no se borra nunca. Ningún dato real en ningún archivo.

## 4. Cómo es un archivo fundido

1. **Cada función, disparador, tabla, columna, índice, restricción, policy y
   permiso aparece UNA sola vez, en su versión final.** `CREATE TABLE` con todas
   sus columnas finales (no `CREATE` + diez `ALTER … ADD COLUMN`), salvo las
   columnas que se añaden a tablas de `main` o de otro bloque, que van como
   `ALTER TABLE … ADD COLUMN`.
2. **Una transacción** (`BEGIN … COMMIT`), con `lock_timeout` y
   `statement_timeout`, **pre-vuelo** (un `DO` que aborta con mensaje claro si
   falta algo de lo que dependes o si ya existe algo tuyo con otra forma),
   **post-vuelo** antes del `COMMIT` (comprueba lo que acabas de crear:
   permisos, RLS activada, que ningún rol tenga de más) y **rejilla final** de
   veredicto (filas OK/REVISAR), como hacen las originales. Los pre-vuelos por
   md5 de cuerpos de OTRAS migraciones de la agenda desaparecen (ya no hay
   cadena); se conservan los que miran objetos de `main` (por ejemplo el md5 de
   `clinica_no_suspendida()` y la forma de `clinica_tiene_acceso()`), y se
   añade la existencia de lo que necesitas de los bloques anteriores.
3. **Re-ejecutable o que aborte limpio:** di cuál de las dos y pruébalo (una
   segunda pasada).
4. **Cabecera corta:** qué hace, de qué depende (bloques anteriores y objetos de
   `main`), qué bloqueos toma y qué riesgo tiene, y cómo se deshace. **La
   historia de las tandas NO va en el archivo.** Los comentarios dentro del SQL
   explican el PORQUÉ de una regla que no es obvia (los candados, el orden de
   las comprobaciones, lo que no hay que «simplificar»), no cuándo se escribió.
   Conserva los avisos que hoy protegen algo (los que `CLAUDE.md` cita en su
   sección «Agenda v2»: léela para tus objetos).
5. **Permisos explícitos en cada objeto:** `REVOKE … FROM PUBLIC` y los `GRANT`
   exactos de la referencia. Las tablas nuevas, sin TRUNCATE para `anon`,
   `authenticated` ni `service_role`. Toda función `SECURITY DEFINER` fija su
   `search_path` y no es ejecutable por PUBLIC.
6. **Nada de datos:** el único backfill del conjunto es el de F1 (los horarios
   de consultorio, con su respaldo). El INSERT de arrastre de avisos de i5 se
   retira (en producción insertaría 0 filas; va a la lista de diferencias).

## 5. Lo común (decidido por el coordinador; Angel lo pidió)

- **El interruptor se lee con UNA función, de F1:**

  ```sql
  public.agenda_v2_encendida(p_clinica_id uuid) RETURNS boolean
  -- LANGUAGE sql, STABLE, SECURITY INVOKER, SET search_path = ''
  -- SELECT coalesce((SELECT a.agenda_v2_encendida FROM public.agenda_ajustes a
  --                  WHERE a.clinica_id = p_clinica_id), false)
  ```

  F1 la crea (sin PUBLIC; EXECUTE a `authenticated` y `service_role`, y a
  `anon` sólo si algún llamador real lo necesita: compruébalo). **INVOKER a
  propósito:** dentro de un disparador INVOKER lee con la RLS de la sesión, y
  dentro de una función DEFINER lee como el dueño, igual que la lectura en
  línea de hoy. Los demás bloques la LLAMAN en vez de repetir el `SELECT`,
  **sólo donde el fragmento actual es exactamente equivalente** (misma tabla,
  misma clínica, «sin fila = false»). Donde no lo sea (lee más columnas a la
  vez, tiene `FOR UPDATE`, o su manejo de error es distinto), se deja como
  está y se anota. Cada sustitución va a tu lista de diferencias.
- **No se crean más piezas comunes.** «Rol de sistema» (`current_user IN …`)
  se queda en línea: cada sitio decide distinto si `service_role` cuenta. Los
  permisos de agenda de las policies se quedan en línea: una función por fila
  puede costar. La clínica de la sesión ya es común (`get_clinica_id()`), y la
  puerta de suscripción sin sesión ya es `gcal_sync_clinica_habilitada` (F2).
  Si ves otra repetición que valga la pena, propónla en tus notas; no la hagas.
- **Contratos entre bloques que no se tocan:** los GUC `spinus.via` y
  `spinus.reagendar_cita` y sus valores; la lista blanca `c_vias` de
  `log_cita_change`; el candado consultivo 1790 y su clave; el literal
  `'por_asignar'`; las firmas de todas las funciones que llama el código
  (búscalas en `src/` antes de cambiar nada). Todo lo de MAPA §3.

## 6. Código muerto: qué se retira

Sólo lo que no tiene ningún efecto observable. Candidatos del inventario,
cada uno a cargo de su dueño, que debe **comprobarlo otra vez** (llamadores en
`src/`, `scripts/`, `e2e/`, `supabase/pruebas-sql/` y en otras funciones):

- `reserva_enlace_regenerar_fijo` (sin llamadores) — F3.
- `reserva_enlace_emitir` de 7 argumentos — F3. El código tiene una caída a
  ella si falta la de 9 (PGRST202): con el conjunto fundido la de 9 siempre
  existe. Se retira; el código de la app NO se toca (anótalo).
- `cita_correos_pendientes` (sin llamadores desde `cita_recordatorios_pendientes`) — F4.
- Cuerpos intermedios, definiciones intermedias de policy, índice o CHECK, y
  columnas de decisiones que cambiaron: no aparecen, sólo la versión final.
- La policy `reserva_enlaces_insert` (F3): hoy no deja pasar nada útil porque
  el disparador rechaza todo INSERT que no sea de `service_role`. **Es una
  comprobación de seguridad: decide con cuidado.** Sólo se retira si sin ella
  el resultado para cada rol es igual o más estricto y el código no depende de
  su error; si dudas, se queda.

Si una prueba de `supabase/pruebas-sql/` o una e2e usa algo que retiras, NO
toques la prueba: dilo en tus notas con el archivo y la línea.

## 7. Cómo compruebas tu archivo (obligatorio, y lo demuestras)

Tu bloque depende de los anteriores, que otros agentes escriben a la vez, así
que no puedes aplicar el conjunto en orden. Tu comprobación propia es
**«quitar lo mío y volver a ponerlo»**:

1. Clona `ref-originales` en un contenedor tuyo.
2. Corre tu **reversa**: quita TODOS tus objetos (y sólo los tuyos), en orden
   inverso de dependencias. Usa `DROP … ` explícitos; evita `CASCADE`. Donde un
   objeto de OTRO bloque depende de uno tuyo (un WHEN, una FK, una función SQL),
   la reversa real del conjunto se correrá en orden inverso de bloques, así que
   tu reversa puede suponer que los bloques POSTERIORES al tuyo ya se quitaron:
   para tu ensayo, quita antes a mano (en un script de ensayo aparte, no en la
   reversa) lo estrictamente necesario de los posteriores, y anótalo como
   «colateral».
3. Aplica tu archivo fundido con `psql -v ON_ERROR_STOP=1`.
4. Compara contra la referencia con `scripts/produccion/comparar-estructura.sh`
   (foto `ref-originales` contra tu contenedor). **Para TUS objetos, cero
   diferencias que no estén en tu lista** `supabase/fusion/diferencias/<bloque>.tsv`
   (formato del comparador: mira `scripts/produccion/esperadas-clon.tsv` y el
   README), cada una con su razón: disparadores unidos, código muerto retirado,
   la llamada a `agenda_v2_encendida`, un CHECK que Postgres reescribe. Una
   diferencia sin razón = tu archivo no está terminado.
5. Segunda pasada de tu archivo (re-ejecutable o aborta limpio).
6. La reversa deja la base, para tus objetos, como `base-main`: compruébalo
   comparando contra la foto `base-main` (con lo colateral explicado).

Una equivalencia completa, con los seis archivos en orden sobre `base-main`, la
correrá después otro agente (E0) que no fundió nada. Lo que tú le dejas son tus
archivos y tu lista de diferencias.

## 8. Tus notas (`supabase/fusion/notas/<bloque>.md`)

Cortas y exactas:
- la lista de tus objetos con «igual que la referencia» o la diferencia;
- lo que retiraste y cómo comprobaste que estaba muerto;
- cada sustitución por `agenda_v2_encendida` (función, y por qué es equivalente)
  y cada sitio donde NO la hiciste;
- lo que necesitas de otro bloque o lo que otro bloque necesitará de ti y no
  estaba en el mapa («peticiones»);
- para el coordinador: pruebas SQL o e2e que tocan lo que cambió, código de la
  app que quedaría como rama muerta, decisiones que son de Angel;
- cifras: líneas de las originales que sustituyes y líneas de tu archivo;
- de cada afirmación, si la comprobaste o la dedujiste.

## 9. Reporte final (corto, en español)

Qué entregas (archivos, rama, commits), el resultado de las comprobaciones de
§7 con sus números, las diferencias a propósito, lo que no pudiste comprobar y
las decisiones que dejas a Angel o al coordinador.
