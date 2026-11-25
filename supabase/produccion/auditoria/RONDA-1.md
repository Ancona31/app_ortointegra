# Auditoría independiente — conjunto de 9 migraciones «agenda v2 lista para producción» — RONDA 1

- **Auditor:** agente independiente (Claude); no escribió ni corrigió ninguna de estas migraciones (dimensión 25).
- **Fecha:** 2026-11-22. **Rama:** `feature/agenda-v2-produccion`, HEAD `e51a64cc`. Sólo lectura sobre el repo.
- **Método:** `supabase/AUDITORIA-MIGRACIONES.md` (dimensiones 1-28, §4-bis), más el conjunto como un todo.
- **Banco de pruebas:** clon propio `clon-spinus-aud-r1` (127.0.0.1:54391) levantado con
  `scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto` → 0 errores de restauración y 0
  diferencias inesperadas con la foto. Datos **sintéticos inventados** (2 clínicas, 4 perfiles, 3
  consultorios, 2 pacientes, 4 citas). Aplicado como `postgres` (no superusuario,
  `search_path "$user", public, extensions`, igual que G.02-G.04 de los conteos), con
  `psql -X -v ON_ERROR_STOP=1 < archivo`, un archivo cada vez. El clon se borró al terminar.
  `audit_log` no se borró ni truncó en ningún momento.
- **Convención:** **COMPROBADO** = lo ejecuté en el clon (o en bash). **DEDUCIDO** = leído en el SQL,
  el catálogo o el código, sin ejecutar.

## Resumen de lo que sí se comprobó ejecutando

| Qué | Resultado |
|---|---|
| Las 9, en orden, sobre la estructura de la foto + datos sintéticos | 9 de 9 con `rc=0`, 0 filas `REVISAR` en la primera pasada |
| Segunda pasada de las 9 | F1, F3, F4 abortan limpio en el pre-vuelo; 20261125, F2, F5b, T repiten en verde; 20261126 y F5a repiten **con una fila `REVISAR` falsa** (A6) |
| Las 9 reversas en orden inverso, sin datos de v2 | 9 de 9 con `rc=0`; el clon vuelve a la foto salvo `respaldos.consultorios_horario_20261119` (documentado); `consultorios.horario` vuelve a su valor previo |
| Aplicar → revertir → reaplicar → revertir F1 | la 2.ª reversa se niega con un motivo falso y, confirmada, **no** devuelve los horarios (A4) |
| Reaplicación completa tras las reversas | 9 de 9 en verde |
| Las 47 pruebas de `supabase/pruebas-sql/` contra el clon migrado | 46 verdes; la roja (`m_saludo_recordatorio.sql`) exige la semilla del proyecto («la semilla no tiene una cita con paciente en A»), no es defecto de la migración |
| Catálogo tras aplicar | 16 tablas nuevas, todas con RLS; ninguna con privilegio para `anon`; ninguna con TRUNCATE para los tres roles; 65 funciones nuevas, todas con `search_path=""`, ninguna ejecutable por PUBLIC; 9 `SECURITY DEFINER` (8 de disparador + `cita_tiene_nota_ligada`); ninguna función ni policy **existente** de producción cambia (comparador del repo, foto ↔ clon) |
| Día a día con la v2 apagada, como `authenticated` | alta, edición, cambio de estado y borrado de citas funcionan; `audit_log` recibe `cita_alta/editada/eliminada` sin valores |
| Aislamiento, con la v2 encendida en la clínica A | un médico de B ve 0 filas de enlaces, avisos, tipos, ajustes, bloqueos, incidencias y contactos de A; `anon` no lee ninguna tabla nueva ni ejecuta `agenda_v2_encendida` |
| Carrera de dos reservas por enlace al mismo turno | una `ok`, otra `ocupado` (el candado 1790 serializa) |

---

## Hallazgos (del más grave al más leve)

### A1 · GRAVE · F3 y F2 retienen ACCESS EXCLUSIVE sobre `appointments` durante 89 y 59 viajes al servidor, y nada acota la espera si la conexión de quien aplica se corta

- **Dónde:** `supabase/migrations/20261201140000_agenda_f3_reserva_enlace.sql:276` (primer
  `ALTER TABLE public.appointments`) hasta el `COMMIT` de `:1570`;
  `supabase/migrations/20261201150000_agenda_f2_google.sql:428` hasta `:1304`. Además, SHARE ROW
  EXCLUSIVE (frena escrituras) sobre `clinicas` y `profiles` desde `F3:216` (92 viajes), sobre
  `clinicas` desde `F2:325` (81 viajes), y sobre `clinicas`/`profiles`/`consultorios` desde `F1:210`
  (65 viajes). Modo de aplicar: `supabase/produccion/plan/aplicar.sh:155` (`psql -f`: una sentencia,
  un viaje por el pooler).
- **Qué pasa:** entre el `ADD COLUMN` de F3 y su `COMMIT` hay 89 sentencias (todas las funciones de
  la reserva); en F2, 59. Todo ese rato **nadie lee ni escribe una cita** en ninguna clínica. Con un
  RTT de 50-150 ms son 4,5-13 s (F3) y 3-9 s (F2); `authenticator` tiene `lock_timeout = 8s` y
  `authenticated` `statement_timeout = 8s` (foto, `05-catalogo.jsonl`), así que por encima de 8 s las
  peticiones de la agenda empiezan a fallar. Y lo que el plan **no** dice: ninguna de las 9 fija
  `idle_in_transaction_session_timeout` (sólo `lock_timeout` y `statement_timeout`, que no cubren a
  una sesión ociosa dentro de la transacción), y en la foto el rol `postgres` no tiene ese ajuste. Si
  la red de quien aplica se cae sin cerrar la conexión (wifi, portátil suspendido) a media F3 o F2,
  el ACCESS EXCLUSIVE sobre `appointments` queda tomado hasta que el pooler o el servidor noten la
  conexión muerta: la agenda de todas las clínicas queda inservible un tiempo que nadie ha medido.
- **Cómo reproducirlo:** el conteo sale de recorrer cada archivo sentencia a sentencia (analizador
  propio que respeta `$…$`, comillas y comentarios): F3, sentencia nº 8 (`L276`) → `COMMIT` en la
  nº 97; F2, nº 26 (`L428`) → `COMMIT` en la nº 85. **COMPROBADO** el conteo (coincide con los «90 y
  60 viajes» que el propio plan admite en `PLAN-DE-APLICACION.md` §5.1 y §12.6, donde lo deja como
  «decisión de Angel / del coordinador» con tres opciones «ninguna probada»). **DEDUCIDO** el caso
  del corte de conexión (un candado dura hasta el fin de la transacción; ASUMIENDO que el servidor de
  producción no fija `idle_in_transaction_session_timeout` a nivel de instancia: la foto no lo trae y
  no se puede ver sin consultar producción).
- **Daño:** agenda (lectura y escritura de citas, tablero del médico, «Próximas citas») detenida
  5-13 s en el caso bueno, con errores sueltos si pasa de 8 s; en el caso del corte, detenida sin
  límite conocido hasta que alguien termine el proceso desde el panel. Los autores ya corrigieron
  esto mismo en F1 (`:716-720`), F4 y F5b; F3 y F2 quedaron fuera.
- **Qué tiene que cumplir la corrección:** (a) entre el primer ACCESS EXCLUSIVE sobre `appointments`
  y el `COMMIT` no hay más que un puñado de viajes (el criterio que el propio conjunto aplica a F1,
  F4 y F5b), **o** el archivo entero viaja en una sola petición; (b) pase lo que pase con el cliente,
  la transacción no puede quedarse ociosa con candados más de unos segundos; (c) el RTT real de la
  terminal de Angel al pooler se mide antes de decidir la hora; (d) lo que se cambie se vuelve a
  ensayar sobre el clon, rejilla incluida. Si se decide no cambiar nada, es una decisión explícita de
  Angel, con (b) y (c) resueltos por otro medio y alguien preparado para `pg_terminate_backend`.

### A2 · MEDIO · `aplicar.sh` afirma «no quedó nada de ella» ante cualquier fallo de `psql`, también cuando el fallo ocurre DESPUÉS del `COMMIT`

- **Dónde:** `supabase/produccion/plan/aplicar.sh:175` (`correr_sql "$f" || die "… Va en una
  transacción: no quedó nada de ella y NO se registró …"`), y `:170`, `:196`, `:209`
  (`grep -qx "$v" <<<"$(registradas)"`).
- **Qué pasa:** las 9 terminan con `COMMIT;` y **después** una `SELECT` (la rejilla; en 20261126 y T
  lee una tabla temporal). Si `psql` sale con error tras el `COMMIT` —la conexión se corta entre el
  `COMMIT` y la rejilla, o la rejilla falla— el archivo **sí quedó aplicado** y el guion dice lo
  contrario. Si el corte cae durante el propio `COMMIT`, el resultado es desconocido y el mensaje lo
  da por deshecho. Segundo punto: si la consulta de `registradas` falla dentro de la condición del
  `if` (ahí bash no aplica `set -e`), la lista sale vacía: una migración ya registrada se trata como
  pendiente (`:170`), una reversa se salta como «no está en el historial» (`:196`) y la comprobación
  final de la reversa (`:209`) pasa sin haber mirado.
- **Cómo reproducirlo:** lectura del guion; el orden `COMMIT` → `SELECT` está en los 9 archivos
  (p. ej. `20261126120000…sql:357` y `:362`). **DEDUCIDO** (no corrí `aplicar.sh` de punta a punta:
  su registro usa `npx supabase`, que sale a la red).
- **Daño:** quien aplica cree que no hay nada aplicado cuando lo hay (o no lo sabe): puede dejar la
  base con una migración aplicada y sin registrar, o lanzar la reversa equivocada, justo el día malo.
- **Qué tiene que cumplir la corrección:** tras un fallo, el guion no afirma el estado: lo **pregunta
  al catálogo** (un objeto testigo por migración) y dice «aplicada sin registrar», «no aplicada» o
  «no lo sé, comprueba X»; y un fallo al leer el historial detiene el guion en vez de contarse como
  «no registrada».

### A3 · MEDIO · `reserva_contactos` acepta desde la sesión un `medico_id` de OTRA clínica (oráculo de existencia y ancla RESTRICT sobre un perfil ajeno)

- **Dónde:** `supabase/migrations/20261201140000_agenda_f3_reserva_enlace.sql:378-395` (tabla y FK
  `reserva_contactos_medico_fkey … REFERENCES public.profiles(id) ON DELETE RESTRICT`), sus policies
  `reserva_contactos_insert/update` y el disparador `proteger_reserva_contactos()`.
- **Qué pasa:** la policy de INSERT sólo exige `clinica_id = get_clinica_id()` y que quien escribe
  sea el propio médico, administrador o **secretaria**; nada comprueba que `medico_id` sea de esa
  clínica (en `reserva_enlaces` y `tipos_cita` sí lo hace un disparador). La FK es de una sola
  columna a `profiles(id)`.
- **Cómo reproducirlo (COMPROBADO, con la v2 apagada o encendida):**
  ```sql
  begin;
  select set_config('request.jwt.claims','{"sub":"<uuid secretaria de A>","role":"authenticated"}',true);
  set local role authenticated;
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('<clínica A>', '<uuid de un perfil de la clínica B>', repeat('9',64), 'telefono', now());  -- entra
  -- con un uuid que no existe: 23503 reserva_contactos_medico_fkey
  rollback;
  ```
- **Daño:** (1) quien tenga sesión en una clínica distingue «este UUID es un perfil de Spinus» de «no
  existe» (entra / 23503); (2) deja una fila que retiene con RESTRICT el perfil de otra clínica: la
  baja de esa persona (`src/app/api/admin/usuarios/route.ts:152`, `profiles.delete()`) daría 409
  `tiene_historia_clinica` sin que su clínica pueda ver ni quitar la causa (**DEDUCIDO** el efecto
  sobre la baja; la inserción, comprobada). Hace falta conocer el UUID ajeno, que no es público: por
  eso MEDIO y no GRAVE. Es la clase del pendiente prioritario de `CLAUDE.md` (aislamiento entre
  clínicas).
- **Qué tiene que cumplir la corrección:** ninguna fila de `reserva_contactos` lleva un `medico_id`
  que no sea un médico de su `clinica_id`, la escriba quien la escriba salvo
  `postgres`/`supabase_admin`, y el error es el mismo exista o no el perfil ajeno. Con una prueba SQL
  que lo intente desde otra clínica.

### A4 · MEDIO · La reversa de F1 sólo devuelve los horarios la PRIMERA vez; en la segunda vuelta se niega con un motivo falso y, confirmada, no restaura nada

- **Dónde:** `supabase/reversas/20261201120000_agenda_f1_ajustes_tipos_horarios_reversa.sql`
  (`UPDATE … WHERE r.id = k.id AND k.updated_at = r.respaldado_en`, y la comprobación «consultorios
  con horario propio editados o creados tras la copia») junto con
  `supabase/migrations/20261201120000_agenda_f1_ajustes_tipos_horarios.sql:795-799`
  (`INSERT … ON CONFLICT (id) DO NOTHING`: se conserva la primera copia, con su primer
  `respaldado_en`).
- **Qué pasa:** la reversa reconoce «nadie lo editó» por `consultorios.updated_at =
  respaldado_en`. Al reaplicar F1 tras una reversa, el respaldo conserva el `respaldado_en` de la
  primera vez, pero el `UPDATE` del backfill pone un `updated_at` nuevo: ya no coinciden nunca.
- **Cómo reproducirlo (COMPROBADO):** aplicar 20261125, 20261126 y F1; correr la reversa de F1 (bien:
  vuelve `{"marca":"previo-A"}`); aplicar F1 otra vez; correr la reversa otra vez →
  `REVERSA ABORTADA: hay datos de la agenda v2 que se perderían: {"consultorios con horario propio
  editados o creados tras la copia: 3"}` (no hay ningún dato de v2); repetir con
  `SET spinus.reversa_con_datos = 'si'` → termina en verde y `consultorios.horario` se queda con el
  horario de la clínica, no con el previo.
- **Daño:** «aplicar, deshacer y volver a aplicar» es el ensayo que pide la dimensión 7; después de
  él, la reversa de F1 ya no cumple lo que su cabecera promete, y pide escribir «PERDER DATOS» por
  datos que no existen (enseña a confirmar sin leer). Lo mismo, en menor grado, la primera vez: basta
  que alguien edite cualquier campo de un consultorio (nombre, teléfono) para que cuente como «dato
  que se perdería» y no recupere su horario. El valor que no se restaura es inerte para el código de
  `main` (nadie lee `consultorios.horario` allí; DEDUCIDO por `git grep` sobre `main`), por eso MEDIO.
- **Qué tiene que cumplir la corrección:** el ciclo aplicar → revertir → reaplicar → revertir deja
  `consultorios.horario` igual que antes de la primera aplicación, sin pedir confirmación cuando no
  hay datos de la v2; y la señal de «editado después» distingue una edición del horario de una
  edición de cualquier otro campo. Con ese ciclo dentro del ensayo.

### A5 · MEDIO · La cadena de reversas quita primero las protecciones (T, F5b) y sólo después descubre que no puede seguir (F4), dejando la v2 encendida sin sus candados

- **Dónde:** `supabase/produccion/plan/aplicar.sh:61-69` (orden T, F5b, F4, F2, F3, F5a, F1) y
  `supabase/reversas/20261201170000_agenda_f5b_protecciones_cita_reversa.sql` (no mira si alguna
  clínica tiene la v2 encendida ni si hay citas reservadas por enlace).
- **Cómo reproducirlo (COMPROBADO):** con `agenda_ajustes.agenda_v2_encendida = true` en una clínica,
  citas reservadas por enlace y sus avisos: reversa de T → `rc=0`; reversa de F5b → `rc=0`; reversa
  de F4 → `REVERSA ABORTADA: hay datos de la v2 que se perderían (avisos_clinica 3)`. Si quien opera
  se detiene ahí (es lo prudente: hay datos), la base queda con los enlaces vivos y **sin**
  `trg_appointments_proteger_reserva`, `_borrado`, `_eleccion`, `_atendida`, `_cierre` ni el bloqueo
  total.
- **Daño:** en ese estado cualquier sesión puede escribir las columnas `reserva_*` (teléfono, correo,
  HMAC del candado), mover o borrar citas reservadas por enlace y cambiar una atendida con nota. Sólo
  ocurre en una reversa con la v2 ya encendida en alguna clínica; es el peor día.
- **Qué tiene que cumplir la corrección:** antes de deshacer la primera se sabe si TODAS las de la
  cadena pueden deshacerse (las comprobaciones de datos de todas, por delante), o la reversa de F5b se
  niega mientras alguna clínica tenga la v2 encendida o existan filas con `reserva_canal`.

### A6 · LEVE · Las rejillas de 20261126 (fila 3) y de F5a (fila 6) dan `REVISAR` al repetirse una vez aplicada T

- **Dónde:** `20261126120000_public_sin_truncate.sql:375-379` (cuenta **todos** los disparadores
  `trg_%_sin_truncate` de la base y espera 11; T añade otros 11 con el mismo patrón y la misma
  función) y la rejilla de `20261201130000_agenda_f5a_bloqueos.sql` (espera sólo
  `audit_agenda_bloqueos,trg_agenda_bloqueos_preparar`; T añade `trg_agenda_bloqueos_sin_truncate`).
- **Cómo reproducirlo (COMPROBADO):** aplicar las 9 y volver a correr esos dos archivos: `rc=0` y una
  fila `REVISAR` (`22` contra `11`; tres disparadores contra dos).
- **Daño:** ninguno en la base. Pero `aplicar.sh:178` trata `REVISAR` como «APLICADA pero NO
  registrada. No sigas»: muerde si se repite 20261126 tras `reversa-truncate`, o cualquiera de las dos
  tras un fallo del registro. Un `REVISAR` falso enseña a ignorar los `REVISAR`.
- **Criterio:** la rejilla de cada archivo cuenta sólo lo que ese archivo crea, de modo que aplicarlo
  antes o después de los demás dé el mismo veredicto.

### A7 · LEVE · El alta de una cita por el personal y la creación de un bloqueo no se serializan con la reserva por enlace: doble reserva posible en una ventana de milisegundos

- **Dónde:** `reservar_por_enlace` (F3) toma `pg_advisory_xact_lock(1790, médico)`;
  `cita_proteger_bloqueo()` (`20261201170000_agenda_f5b_protecciones_cita.sql:238-265`) y las altas
  de la sesión no lo toman.
- **Cómo reproducirlo (COMPROBADO):** sesión 1, como `authenticated`: `begin; insert` de una cita del
  médico en el turno T; `select pg_sleep(3); commit;`. Sesión 2, un segundo después, como
  `service_role`: `reservar_por_enlace(...)` al mismo turno → `ok`. Quedan dos citas activas en el
  mismo turno. Por la misma razón, un bloqueo que se confirma mientras el personal inserta deja una
  cita dentro del bloqueo «total» (**DEDUCIDO**).
- **Daño:** dos pacientes en el mismo turno; raro (PostgREST confirma cada alta en milisegundos).
- **Criterio:** o se escribe como límite aceptado (el bloqueo es total salvo carrera), o las dos
  escrituras comparten el candado del médico.

### A8 · LEVE · `aplicar.sh respaldo`: el mensaje «pg_dump falló: el respaldo NO vale. Bórralo» es inalcanzable

- **Dónde:** `supabase/produccion/plan/aplicar.sh:226-240`.
- **Qué pasa:** con `set -euo pipefail`, si `pg_dump` falla la tubería `pg_dump | gpg` devuelve ≠ 0 y
  el guion muere ahí mismo; la línea `[[ ${PIPESTATUS[0]} -eq 0 ]] || die …` (`:240`) no se ejecuta.
- **Cómo reproducirlo (COMPROBADO en bash):**
  `bash -c 'set -eo pipefail; f() { if true; then (exit 3) | cat; fi; echo "no se llega"; }; f; echo fin'`
  → no imprime nada y sale con 3.
- **Daño:** queda un `respaldo-*.dump.gpg` truncado con nombre de respaldo bueno, sin el aviso de
  borrarlo y sin `.sha256`. Se ve el error de `pg_dump` y falta la línea «Hecho», pero el archivo
  engaña a quien llegue después.
- **Criterio:** un respaldo fallido no deja en disco un archivo con nombre de respaldo válido, y lo
  dice.

### A9 · LEVE · Tres tablas nuevas guardan ids de citas sin llave foránea

- **Dónde:** `avisos_clinica.cita_id`, `gcal_movimientos_rechazados.cita_id`,
  `reserva_empalmes_google.cita_reserva_id` / `cita_otra_id` (F4 y F2). **COMPROBADO** en
  `pg_constraint` del clon: no hay FK a `appointments` desde ellas.
- **Daño:** al borrar un evento sin paciente (permitido también con la v2) quedan avisos huérfanos,
  invisibles (las policies exigen que la cita exista) pero para siempre; la semilla y cualquier
  limpieza tienen que acordarse de ellas a mano.
- **Criterio:** o FK RESTRICT como en las demás tablas de la v2 (regla del proyecto), o el motivo de
  no ponerla escrito en el `COMMENT` de la columna.

### A10 · NOTA · Las acciones referenciales (`ON DELETE SET NULL`/`CASCADE`) pasan por encima de todos los candados de la cita

- **COMPROBADO:** como `service_role`, `delete from public.consultorios where id = …` deja
  `consultorio_id = NULL` en una cita reservada por enlace futura (el candado de elección no lo
  impide: la acción corre como el dueño, `postgres`). Hoy la app archiva consultorios, no los borra
  (`src/app/api/consultorios/[id]/route.ts:320`), así que no muerde; queda dicho para quien añada un
  borrado.

### A11 · NOTA · F5b sube de candado sobre `appointments` dentro de la transacción (SHARE → SHARE ROW EXCLUSIVE → ACCESS EXCLUSIVE)

- **DEDUCIDO** (`20261201170000…sql:467-540`): una transacción ajena que ya leyó `appointments` y
  luego quiere escribirla puede acabar en abrazo mortal con F5b; PostgreSQL mata a una de las dos al
  segundo. Ventana de 12 viajes. Fuera de horario es improbable.

### A12 · NOTA · Cabeceras que ya no dicen la verdad

- `20261125170000…sql:83` y `20261126120000…sql:126` siguen diciendo «EJECUTAR EN EL SQL EDITOR»;
  `20261126120000…sql:12-13` dice «PENDIENTE DE AUDITORÍA INDEPENDIENTE» y su rejilla (`:371`) «30 la
  primera vez en local» (en producción serán 28, según M2.8 de los conteos: 29 con `audit_log`, que
  ya habrá quitado 20261125).

---

## Juicio sobre la sección 4-bis (privilegios por omisión, `20261126120000:261`)

**Se queda, tal como está.** Razones, comprobadas en el clon:

1. Hace exactamente lo que dice y nada más: tras aplicarla, `pg_default_acl` de `postgres` en `public`
   para tablas queda `anon/authenticated/service_role = arwdxtm` (sin `D`); secuencias y funciones,
   intactas; una tabla creada después por `postgres` nace sin TRUNCATE para los tres (lo comprobé
   creando y borrando una tabla de prueba); una creada por `supabase_admin` nace con TRUNCATE (el
   límite que la sección ya describe, también comprobado).
2. Sin ella el invariante «cero TRUNCATE en `public`» se rompería con la primera tabla nueva, y
   TRUNCATE no pasa por la RLS ni por la auditoría.
3. No encontré nada que dependa de ese privilegio: ni en `src/`, ni en `scripts/`, ni en las 47
   pruebas SQL (46 verdes sobre el clon). En el clon restaurado de la foto no hay entradas globales
   (sin esquema) en `pg_default_acl` que la dejen sin efecto.

Condiciones (ninguna impide aplicar):

- **Los `REVOKE TRUNCATE` tabla a tabla de las migraciones de la agenda no se quitan** por
  «redundantes»: mantienen cada archivo correcto si se aplica sin 20261126 o tras `reversa-truncate`.
- **Nada vigila que el ajuste siga ahí.** Si la plataforma o alguien repone los privilegios por
  omisión, la siguiente tabla nace con TRUNCATE y sólo se nota al volver a correr 20261126. Hace
  falta una comprobación periódica (sirve la fila 1 de su rejilla: «tablas de public con TRUNCATE
  para los tres = 0»).
- **Lo que no pude verificar:** qué rol usan las herramientas del panel de Supabase para «vaciar
  tabla»; si es `postgres` o `supabase_admin` el `REVOKE` no les afecta, y en las 22 tablas con
  disparador las frena el disparador, que es lo que se quiere.

---

## Lo que parecía sospechoso y está bien

- **El backfill de F1 pisa `consultorios.horario` en las 18 filas de producción.** El valor previo es
  inerte en `main` (la API lo acepta pero nada lo lee; `git grep` sobre `main`), queda respaldado
  antes del `UPDATE`, y la primera reversa lo devuelve (comprobado). El horario efectivo no cambia.
- **`cita_tiene_nota_ligada` es DEFINER y la ejecuta `authenticated`.** Devuelve sólo un booleano y
  `false` para otra clínica (comprobado desde B). Una secretaria sí aprende que una cita de su clínica
  tiene nota: es el propósito declarado.
- **`gcal_sync_clinica_habilitada` ejecuta SQL dinámico** sacado del cuerpo de
  `clinica_no_suspendida()` y `clinica_tiene_acceso()`. Con los cuerpos de la foto devuelve `true`
  (comprobado); sólo la ejecuta `service_role`; si la forma cambia, falla cerrado.
- **`reserva_enlace_emitir` con un actor administrador de B y un médico de A:** rechazado por el
  disparador, y la revocación previa del fijo va filtrada por clínica (comprobado).
- **El contador del enlace único (dimensión 27):** leí `reservar_por_enlace` entera; tras el
  incremento sólo hay resultados devueltos y el INSERT en su subbloque; una reserva `ocupado` deja
  `intentos` subido (comprobado).
- **Recursión de RLS (dimensión 19):** ninguna policy nueva lee su propia tabla; las de
  `avisos_clinica`, `cita_*` y `reserva_empalmes_google` leen `appointments`, cuyas policies no leen
  ninguna tabla nueva. Las policies de `appointments` no cambian.
- **Columnas `reserva_*` y HMAC visibles por PostgREST y Realtime:** las ve quien ya ve la cita
  (misma RLS); la publicación `supabase_realtime` sigue teniendo sólo `appointments`.
- **Estados intermedios entre archivos:** con F3 aplicada y F5b no, la sesión no puede fabricar una
  cita «reservada»: el CHECK exige `reserva_enlace_id`, y los enlaces sólo los inserta `service_role`.
- **Borrar citas con la v2 apagada sigue funcionando**, también como sesión y con paciente
  (comprobado); lo único que cambia para todos es la atendida con nota.
- **`conteos.sql` sólo lee:** `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`, sin sentencias de escritura.
- **Huellas:** `sha256sum -c supabase/produccion/plan/huellas.sha256` → los 18 archivos OK.

---

## Lo que NO pude auditar, y por qué

1. **`aplicar.sh` de punta a punta** (registro con `supabase migration repair`, mensajes, modo
   `reversa`): su registro usa `npx supabase@2.117.0`, que sale a la red; lo leí, no lo corrí.
2. **El pooler real:** RTT, cómo presenta Supavisor los `NOTICE` y la rejilla, y cuánto tarda en
   soltar una conexión muerta. Sólo se puede medir contra producción.
3. **El código de la aplicación en marcha** (prohibidos build, Vitest y Playwright). Leí por muestreo
   que las lecturas principales de citas no piden columnas nuevas sin tolerancia (`consultaCitas.ts`,
   `ProximasCitas.tsx`, tablero) y la ruta de cron de Google; **no** verifiqué ruta por ruta la
   ventana «código nuevo + base vieja» ni los `createAdminClient()` nuevos uno a uno.
4. **Cuerpos que no leí enteros:** `reagendar_por_enlace`, `cita_reagendar_clinica`,
   `cita_reagendar_oferta`, `gcal_bloqueo_aplicar`, `gcal_sync_tomar/avanzar/soltar/reiniciar`,
   `gcal_citas_por_evento`, `cita_rsvp_google`, `reserva_contexto`, `reserva_ocupacion`,
   `reserva_codigo_emitir/verificar`, `reserva_espera_reenvio`, `rate_limit_espera`,
   `cita_confirmacion_contexto/emitir/revocar`, `reserva_empalmes_registrar` y los pre y post-vuelos
   de F3, F2, F4, F5a y T. De ellos sólo tengo el catálogo (INVOKER, `search_path` vacío, sólo
   `service_role`) y las pruebas SQL del proyecto en verde sobre el clon. Leí enteras: 20261125,
   20261126, F1, F5b, `reservar_por_enlace`, `reserva_enlace_emitir`, `gcal_aplicar_evento`,
   `gcal_importar_evento`, `cita_confirmacion_responder`, `cita_correo_tomar`,
   `cita_recordatorios_pendientes`, los `proteger_*`, los `aviso_clinica_*` principales y la reversa
   de F1.
5. **Lo que depende de filas reales** (dimensiones 7-9): sólo los conteos del 2026-11-22; todos `OK`
   o `INFO`, ninguno contradice lo visto en el clon.
6. **Replay desde `supabase/baseline/`** y `supabase db reset --local`: no toqué el stack local.
7. **Las reversas de F4, F2, F3 y F5a confirmando la pérdida de datos:** sólo las corrí sin datos
   (verdes) y vi sus negativas con datos.

**Formato del método:** el punto 5-b («el archivo corregido completo») no se entrega: el encargo
prohíbe reescribir. El §6 pide añadir dimensiones al documento y no puedo editar el repo; propongo
tres para que las añada quien corresponda: **(29)** candado fuerte × viajes del cliente, con guarda
para la conexión que se corta; **(30)** FK de una sola columna hacia una tabla de varias clínicas en
una tabla que la sesión puede escribir; **(31)** una cadena de reversas comprueba todas sus negativas
antes de deshacer la primera.

---

## Veredicto

**¿Hay hallazgos que impidan aplicar a producción? No: ninguno es BLOQUEANTE.** Hay un GRAVE (A1) que
pide una decisión explícita antes de aplicar F3 y F2 —acortar la ventana o, como mínimo, acotar la
transacción ociosa y medir el RTT—, y cuatro MEDIOS (A2-A5): A2 conviene corregirlo antes de usar
`aplicar.sh` contra producción, y A3 antes de encender la v2 en ninguna clínica.
